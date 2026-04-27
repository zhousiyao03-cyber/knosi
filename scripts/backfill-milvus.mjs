#!/usr/bin/env node
// Backfill: 把现有的 knowledge_chunk_embeddings (Turso/SQLite) 复制到 Milvus
//
// Usage:
//   node --env-file=.env.local scripts/backfill-milvus.mjs
//   node --env-file=.env.local scripts/backfill-milvus.mjs --rebuild   # drop 再重建
//   node --env-file=.env.local scripts/backfill-milvus.mjs --resume    # 只重试 .backfill-milvus-failed.json
//
// 直连 libsql + Milvus SDK，不 import .ts，兼容 Node 20。

import { createClient } from "@libsql/client";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const REBUILD = args.includes("--rebuild");
const RESUME = args.includes("--resume");

const FAILED_PATH = ".backfill-milvus-failed.json";
const PAGE_SIZE = 200;
const BATCH_SIZE = 100;

if (!process.env.MILVUS_URI || !process.env.MILVUS_TOKEN) {
  console.error("MILVUS_URI / MILVUS_TOKEN 未设置");
  process.exit(1);
}
if (!process.env.TURSO_DATABASE_URL) {
  console.error("TURSO_DATABASE_URL 未设置");
  process.exit(1);
}

const collectionName =
  process.env.MILVUS_COLLECTION || "knosi_knowledge_chunks";
const VECTOR_DIM = 384;

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const milvus = new MilvusClient({
  address: process.env.MILVUS_URI,
  token: process.env.MILVUS_TOKEN,
});

function vectorBufferToArray(buffer) {
  if (!buffer) return [];
  const u8 = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const view = new Float32Array(
    u8.buffer,
    u8.byteOffset,
    u8.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
  return Array.from(view);
}

async function ensureCollection() {
  const exists = await milvus.hasCollection({
    collection_name: collectionName,
  });
  if (exists.value) return;

  console.log(`[backfill] creating collection ${collectionName}`);
  await milvus.createCollection({
    collection_name: collectionName,
    fields: [
      {
        name: "chunk_id",
        data_type: DataType.VarChar,
        is_primary_key: true,
        max_length: 64,
      },
      { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM },
      { name: "user_id", data_type: DataType.VarChar, max_length: 64 },
      { name: "source_type", data_type: DataType.VarChar, max_length: 8 },
      { name: "source_id", data_type: DataType.VarChar, max_length: 64 },
    ],
  });
  await milvus.createIndex({
    collection_name: collectionName,
    field_name: "vector",
    index_type: "HNSW",
    metric_type: "COSINE",
    params: { M: 16, efConstruction: 200 },
  });
}

if (REBUILD) {
  console.log(`[backfill] dropping collection ${collectionName}`);
  await milvus.dropCollection({ collection_name: collectionName });
}

await ensureCollection();
await milvus.loadCollection({ collection_name: collectionName });

let resumeIds = null;
if (RESUME) {
  try {
    resumeIds = new Set(JSON.parse(await readFile(FAILED_PATH, "utf8")));
    console.log(`[backfill] resume: ${resumeIds.size} chunkIds`);
  } catch {
    console.error(`No resume file ${FAILED_PATH}`);
    process.exit(1);
  }
}

let offset = 0;
const failed = [];
let totalSeen = 0;
let totalUpserted = 0;
let totalSkipped = 0;

while (true) {
  // SQLite 不能在不同 attached DB 里做 JOIN，但 Turso 是单库，可以一次 JOIN
  // 拉出 chunk metadata + embedding blob
  const result = await turso.execute({
    sql: `
      SELECT
        ce.chunk_id   AS chunk_id,
        ce.vector     AS vector,
        c.user_id     AS user_id,
        c.source_type AS source_type,
        c.source_id   AS source_id
      FROM knowledge_chunk_embeddings ce
      LEFT JOIN knowledge_chunks c ON c.id = ce.chunk_id
      ORDER BY ce.chunk_id
      LIMIT ? OFFSET ?
    `,
    args: [PAGE_SIZE, offset],
  });

  if (result.rows.length === 0) break;
  totalSeen += result.rows.length;

  const records = [];
  for (const row of result.rows) {
    const chunkId = String(row.chunk_id);
    if (resumeIds && !resumeIds.has(chunkId)) continue;
    if (!row.user_id) {
      // 孤儿 embedding 或 legacy chunk 没 userId — 跳
      totalSkipped++;
      continue;
    }
    const vector = vectorBufferToArray(row.vector);
    if (vector.length !== VECTOR_DIM) {
      console.warn(
        `[backfill] dim mismatch ${chunkId}: ${vector.length} (期望 ${VECTOR_DIM})`
      );
      failed.push(chunkId);
      continue;
    }
    records.push({
      chunk_id: chunkId,
      vector,
      user_id: String(row.user_id),
      source_type: String(row.source_type),
      source_id: String(row.source_id),
    });
  }

  // Milvus 这边按 BATCH_SIZE 切，每批一次 upsert
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      const upsertResult = await milvus.upsert({
        collection_name: collectionName,
        data: batch,
      });
      if (
        upsertResult.status?.error_code &&
        upsertResult.status.error_code !== "Success"
      ) {
        throw new Error(
          `${upsertResult.status.error_code} ${upsertResult.status.reason ?? ""}`
        );
      }
      totalUpserted += batch.length;
    } catch (err) {
      console.error(
        `[backfill] batch offset=${offset}+${i} 失败: ${err.message}`
      );
      failed.push(...batch.map((b) => b.chunk_id));
    }
  }

  console.log(
    `[backfill] page offset=${offset}: 见 ${result.rows.length}, 写 ${records.length}, 累计成功 ${totalUpserted}`
  );
  offset += PAGE_SIZE;
}

const stats = await milvus.getCollectionStatistics({
  collection_name: collectionName,
});
const milvusCount = Number(
  stats.stats?.find((s) => s.key === "row_count")?.value ?? 0
);

console.log(`\n[backfill] 完成:`);
console.log(`  Turso 总行数            : ${totalSeen}`);
console.log(`  推到 Milvus 成功        : ${totalUpserted}`);
console.log(`  跳过（孤儿/无 userId）  : ${totalSkipped}`);
console.log(`  失败                    : ${failed.length}`);
console.log(`  Milvus collection 行数  : ${milvusCount}（含本次新写）`);

if (failed.length > 0) {
  await writeFile(FAILED_PATH, JSON.stringify(failed, null, 2));
  console.error(`\n失败的 chunkId 写到 ${FAILED_PATH}，--resume 可重试。`);
  process.exit(1);
}

if (Math.abs(milvusCount - totalUpserted) > 5 && !RESUME) {
  console.warn(
    `\n警告: Milvus 行数（${milvusCount}）与本次成功（${totalUpserted}）差距>5。`
  );
}
