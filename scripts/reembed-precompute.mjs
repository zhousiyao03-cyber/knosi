/**
 * Phase 1 of the embedding migration: pre-compute all new vectors LOCALLY
 * and cache them to disk. Does NOT touch the production embeddings table —
 * safe to run before the new code is deployed.
 *
 * Phase 2 (reembed-swap.mjs) does the atomic DELETE-old + INSERT-new
 * once the deployment is live.
 *
 * Output: tmp/reembed-vectors-<ts>.jsonl
 *   one JSON object per line: { chunkId, vectorHex }
 *   vectorHex is the Float32 buffer hex-encoded (so it's a valid JSON string)
 *
 * Run: node scripts/reembed-precompute.mjs
 *
 * Idempotent: if a fresh JSONL exists, this skips re-embedding chunks
 * already covered. Re-running is cheap.
 */
import { createClient } from "@libsql/client";
import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
    })
);

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const MODEL_ID = "Xenova/multilingual-e5-small";
const BATCH_SIZE = 32;

mkdirSync("./tmp", { recursive: true });

// Resume support: read all existing reembed-vectors-*.jsonl files,
// load chunk IDs already covered, skip them.
function loadAlreadyDone() {
  const files = readdirSync("./tmp").filter((f) =>
    f.startsWith("reembed-vectors-") && f.endsWith(".jsonl")
  );
  const done = new Set();
  for (const f of files) {
    for (const line of readFileSync(`./tmp/${f}`, "utf8").split("\n")) {
      if (!line) continue;
      try { done.add(JSON.parse(line).chunkId); } catch {}
    }
  }
  return done;
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `./tmp/reembed-vectors-${ts}.jsonl`;

async function main() {
  const alreadyDone = loadAlreadyDone();
  console.log(`Already-done chunks from previous JSONL files: ${alreadyDone.size}`);

  console.log(`Loading model ${MODEL_ID}...`);
  const t0 = Date.now();
  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
  });
  console.log(`  loaded in ${Date.now() - t0}ms`);

  const totalRow = await client.execute(`SELECT count(*) as n FROM knowledge_chunks`);
  const total = Number(totalRow.rows[0].n);
  console.log(`\nFetching all ${total} chunks (id + text) from prod Turso...`);

  // Stream in pages so we don't load 2700 rows at once.
  const PAGE = 500;
  let offset = 0;
  let writtenThisRun = 0;
  console.log(`Output: ${outPath}\n`);

  while (true) {
    const page = await client.execute({
      sql: `SELECT id, text FROM knowledge_chunks
            ORDER BY source_updated_at DESC, created_at DESC
            LIMIT ? OFFSET ?`,
      args: [PAGE, offset],
    });
    if (page.rows.length === 0) break;

    // Filter out already-done chunks
    const remaining = page.rows.filter((r) => !alreadyDone.has(String(r.id)));
    console.log(
      `[page offset=${offset}] received ${page.rows.length} chunks, ${remaining.length} need embedding`
    );

    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const batch = remaining.slice(i, i + BATCH_SIZE);
      const tStart = Date.now();
      const tensor = await extractor(
        batch.map((c) => "passage: " + c.text),
        { pooling: "mean", normalize: true }
      );
      const dims = tensor.dims[1];
      const flat = Array.from(tensor.data);

      for (let j = 0; j < batch.length; j += 1) {
        const vec = flat.slice(j * dims, (j + 1) * dims);
        const buf = Buffer.from(new Float32Array(vec).buffer);
        appendFileSync(
          outPath,
          JSON.stringify({ chunkId: String(batch[j].id), vectorHex: buf.toString("hex") }) + "\n"
        );
      }

      writtenThisRun += batch.length;
      console.log(
        `  +${batch.length} written=${writtenThisRun}/${total} (${Date.now() - tStart}ms)`
      );
    }

    offset += PAGE;
  }

  console.log(`\n✅ done. wrote ${writtenThisRun} new vectors to ${outPath}`);
  console.log(`Run reembed-swap.mjs after deploy to apply.`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
