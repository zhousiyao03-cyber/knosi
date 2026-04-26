/**
 * Backfill knowledge_chunk_embeddings for chunks missing them.
 *
 * Why: indexer's embedTexts() can fail silently (rate limit, transient API
 * error) — chunk gets inserted, embedding does not. Failed embedding does
 * NOT mark the index job as failed, so the cron worker won't retry.
 *
 * Strategy: find orphan chunks, batch into 10-chunk groups, call Gemini's
 * embedContent (one batch = one API call), insert, sleep so we stay under
 * 100 RPM. Idempotent — if rerun, only handles still-missing rows.
 *
 * Run: GOOGLE_GENERATIVE_AI_API_KEY=... node scripts/backfill-embeddings.mjs
 */
import { createClient } from "@libsql/client";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
    })
  );
}

const tursoEnv = loadEnv("D:/repos/knosi/.env.turso-prod.local");
const geminiEnv = loadEnv("D:/repos/knosi/.env.gemini.local");

const client = createClient({
  url: tursoEnv.TURSO_DATABASE_URL,
  authToken: tursoEnv.TURSO_AUTH_TOKEN,
});

const provider = createGoogleGenerativeAI({
  apiKey: geminiEnv.GOOGLE_GENERATIVE_AI_API_KEY,
});
const MODEL_ID = "gemini-embedding-001";
const model = provider.textEmbeddingModel(MODEL_ID);

const BATCH_SIZE = 8;
const SLEEP_MS = 9_000; // 8 chunks per ~9s = ~53 chunks/min, well under 100 RPM

function normalize(vec) {
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag);
  if (!Number.isFinite(mag) || mag <= 0) return vec;
  return vec.map((v) => v / mag);
}

function vectorToBuffer(vector) {
  return Buffer.from(new Float32Array(vector).buffer);
}

async function getOrphanBatch(limit) {
  // Prefer chunks whose source note was most recently updated — the user
  // is likely asking about recent work, so semantic search should cover
  // those first. Falls back to chunk created_at as a tiebreaker.
  const r = await client.execute({
    sql: `SELECT c.id, c.text FROM knowledge_chunks c
          WHERE NOT EXISTS (SELECT 1 FROM knowledge_chunk_embeddings e WHERE e.chunk_id = c.id)
          ORDER BY c.source_updated_at DESC, c.created_at DESC
          LIMIT ?`,
    args: [limit],
  });
  return r.rows.map((row) => ({ id: row.id, text: row.text }));
}

async function totalRemaining() {
  const r = await client.execute(
    `SELECT count(*) as n FROM knowledge_chunks c
     WHERE NOT EXISTS (SELECT 1 FROM knowledge_chunk_embeddings e WHERE e.chunk_id = c.id)`
  );
  return Number(r.rows[0].n);
}

async function insertEmbeddings(chunks, vectors) {
  const now = Math.floor(Date.now() / 1000);
  const placeholders = chunks.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const args = [];
  for (let i = 0; i < chunks.length; i++) {
    const normalized = normalize(vectors[i]);
    args.push(
      chunks[i].id,
      MODEL_ID,
      normalized.length,
      vectorToBuffer(normalized),
      now
    );
  }
  await client.execute({
    sql: `INSERT INTO knowledge_chunk_embeddings (chunk_id, model, dims, vector, created_at)
          VALUES ${placeholders}`,
    args,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const start = await totalRemaining();
  console.log(`Starting backfill — ${start} chunks missing embeddings`);
  console.log(`Batch size ${BATCH_SIZE}, sleep ${SLEEP_MS}ms → ~${Math.round(60_000 / SLEEP_MS * BATCH_SIZE)} chunks/min`);
  console.log(`ETA ~${Math.round(start * SLEEP_MS / BATCH_SIZE / 60_000)} minutes\n`);

  let done = 0;
  let consecutiveErrors = 0;
  while (true) {
    const batch = await getOrphanBatch(BATCH_SIZE);
    if (batch.length === 0) {
      console.log("\n✅ all chunks have embeddings");
      break;
    }
    const t0 = Date.now();
    try {
      const { embeddings } = await embedMany({
        model,
        values: batch.map((c) => c.text),
      });
      await insertEmbeddings(batch, embeddings);
      done += batch.length;
      consecutiveErrors = 0;
      const remaining = await totalRemaining();
      console.log(
        `[${new Date().toLocaleTimeString("en-GB", { hour12: false })}] ` +
        `+${batch.length} done=${done} remaining=${remaining} (${Date.now() - t0}ms)`
      );
    } catch (err) {
      consecutiveErrors++;
      const msg = err?.message ?? String(err);
      console.error(
        `[${new Date().toLocaleTimeString("en-GB", { hour12: false })}] ` +
        `batch failed (consec=${consecutiveErrors}): ${msg.slice(0, 150)}`
      );
      // Most failures are Gemini free-tier rate limits, which reset within
      // minutes. Don't bail — backoff up to 5 minutes between attempts and
      // keep going until everything is embedded.
      const backoffMs = Math.min(
        5 * 60_000,
        SLEEP_MS * Math.pow(2, Math.min(consecutiveErrors, 6))
      );
      console.error(`  backing off ${Math.round(backoffMs/1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    await sleep(SLEEP_MS);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
