/**
 * Phase 2 of the embedding migration: apply pre-computed vectors to prod.
 *
 * Reads the JSONL files written by reembed-precompute.mjs and atomically
 * swaps prod's knowledge_chunk_embeddings table:
 *   1. dump existing rows for safety (tmp/embeddings-backup-<ts>.json)
 *   2. DELETE FROM knowledge_chunk_embeddings (in one libsql batch)
 *   3. INSERT all pre-computed rows (in batches of 100)
 *
 * libsql doesn't expose multi-statement transactions to client SDK in the
 * way SQLite does locally, but `client.batch([...])` runs all statements
 * atomically — either they all commit or all roll back.
 *
 * Run AFTER the new code (Transformers.js embedding) is live in prod.
 *
 * Usage:
 *   node scripts/reembed-swap.mjs                 # use newest JSONL file
 *   node scripts/reembed-swap.mjs <path-to.jsonl> # explicit file
 *   node scripts/reembed-swap.mjs --dry-run       # plan only
 */
import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

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
const DIMS = 384;
const INSERT_BATCH = 100;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const explicitPath = args.find((a) => !a.startsWith("--"));

function pickJsonl() {
  if (explicitPath) return explicitPath;
  const files = readdirSync("./tmp")
    .filter((f) => f.startsWith("reembed-vectors-") && f.endsWith(".jsonl"))
    .sort()
    .reverse();
  if (files.length === 0) {
    throw new Error("no reembed-vectors-*.jsonl in ./tmp — run reembed-precompute.mjs first");
  }
  return `./tmp/${files[0]}`;
}

function readJsonl(path) {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const map = new Map();
  for (const line of lines) {
    const { chunkId, vectorHex } = JSON.parse(line);
    map.set(chunkId, Buffer.from(vectorHex, "hex"));
  }
  return map;
}

async function dumpExisting() {
  const rows = await client.execute(
    `SELECT chunk_id, model, dims, hex(vector) as vector_hex, created_at
     FROM knowledge_chunk_embeddings`
  );
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("./tmp", { recursive: true });
  const path = `./tmp/embeddings-backup-${ts}.json`;
  writeFileSync(path, JSON.stringify(rows.rows, null, 2));
  return { count: rows.rows.length, path };
}

async function main() {
  const jsonlPath = pickJsonl();
  console.log(`Reading vectors from ${jsonlPath}`);
  const vectors = readJsonl(jsonlPath);
  console.log(`  ${vectors.size} pre-computed vectors loaded`);

  // Sanity: every chunk in prod should have a vector ready.
  const chunkRows = await client.execute(
    `SELECT id FROM knowledge_chunks`
  );
  const allChunkIds = new Set(chunkRows.rows.map((r) => String(r.id)));
  const missing = [...allChunkIds].filter((id) => !vectors.has(id));
  console.log(`Prod has ${allChunkIds.size} chunks; ${missing.length} have no pre-computed vector`);
  if (missing.length > 0) {
    console.log(`  first 5 missing: ${missing.slice(0, 5).join(", ")}`);
    if (missing.length > 50) {
      throw new Error(`too many missing — re-run reembed-precompute.mjs first`);
    }
  }

  // Drop entries from JSONL that no longer correspond to a chunk in prod
  // (chunk might have been deleted between precompute and swap).
  const orphanedInJsonl = [...vectors.keys()].filter((id) => !allChunkIds.has(id));
  for (const id of orphanedInJsonl) vectors.delete(id);
  console.log(`Dropped ${orphanedInJsonl.length} JSONL entries without a matching chunk`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — would now:");
    console.log(`  1. dump current ${(await client.execute(`SELECT count(*) as n FROM knowledge_chunk_embeddings`)).rows[0].n} embeddings to JSON`);
    console.log(`  2. DELETE all knowledge_chunk_embeddings`);
    console.log(`  3. INSERT ${vectors.size} new rows in batches of ${INSERT_BATCH}`);
    return;
  }

  console.log("\nDumping current embeddings to backup...");
  const dump = await dumpExisting();
  console.log(`  dumped ${dump.count} rows → ${dump.path}`);

  console.log("\nBuilding atomic batch...");
  const now = Math.floor(Date.now() / 1000);
  const stmts = [{ sql: `DELETE FROM knowledge_chunk_embeddings`, args: [] }];

  const entries = [...vectors.entries()];
  for (let i = 0; i < entries.length; i += INSERT_BATCH) {
    const batch = entries.slice(i, i + INSERT_BATCH);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const args = [];
    for (const [chunkId, buf] of batch) {
      args.push(chunkId, MODEL_ID, DIMS, buf, now);
    }
    stmts.push({
      sql: `INSERT INTO knowledge_chunk_embeddings (chunk_id, model, dims, vector, created_at) VALUES ${placeholders}`,
      args,
    });
  }

  console.log(`  ${stmts.length} statements (1 DELETE + ${stmts.length - 1} batched INSERTs)`);
  console.log("Running batch...");

  const tStart = Date.now();
  await client.batch(stmts, "write");
  console.log(`✅ swap completed in ${Date.now() - tStart}ms`);

  const verify = await client.execute(
    `SELECT model, dims, count(*) as n FROM knowledge_chunk_embeddings GROUP BY model, dims`
  );
  console.log("\nNew embedding distribution:");
  for (const row of verify.rows) {
    console.log(`  model=${row.model} dims=${row.dims} count=${row.n}`);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
