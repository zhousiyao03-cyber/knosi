#!/usr/bin/env node
// Backfill: 把现有的 knowledge_chunk_embeddings (Turso/SQLite) 复制到 Milvus
//
// Usage:
//   node --experimental-strip-types --env-file=.env.local scripts/backfill-milvus.mjs
//   node ... scripts/backfill-milvus.mjs --rebuild   # 先 drop 再重建 collection
//   node ... scripts/backfill-milvus.mjs --resume    # 只重试 .backfill-milvus-failed.json 里的 chunkId
//
// 幂等：用 chunk_id 当主键，重复运行不爆。
// 失败的 chunkId 写到仓库根的 .backfill-milvus-failed.json（已 gitignore）。

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const args = process.argv.slice(2);
const REBUILD = args.includes("--rebuild");
const RESUME = args.includes("--resume");

const FAILED_PATH = resolve(repoRoot, ".backfill-milvus-failed.json");
const PAGE_SIZE = 200;

if (!process.env.MILVUS_URI || !process.env.MILVUS_TOKEN) {
  console.error("MILVUS_URI / MILVUS_TOKEN 未设置，没法 backfill。");
  process.exit(1);
}

const collectionName =
  process.env.MILVUS_COLLECTION || "knosi_knowledge_chunks";

const { db } = await import(resolve(repoRoot, "src/server/db/index.ts"));
const { knowledgeChunks, knowledgeChunkEmbeddings } = await import(
  resolve(repoRoot, "src/server/db/schema/index.ts")
);
const { vectorBufferToArray } = await import(
  resolve(repoRoot, "src/server/ai/embeddings.ts")
);
const { getVectorStore } = await import(
  resolve(repoRoot, "src/server/ai/vector-store.ts")
);
const { inArray } = await import("drizzle-orm");

if (REBUILD) {
  const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
  const client = new MilvusClient({
    address: process.env.MILVUS_URI,
    token: process.env.MILVUS_TOKEN,
  });
  console.log(`[backfill] dropping collection ${collectionName}`);
  await client.dropCollection({ collection_name: collectionName });
}

const store = getVectorStore();
if (!store) {
  console.error("vector store 初始化失败");
  process.exit(1);
}
await store.ensureCollection();

let resumeIds = null;
if (RESUME) {
  try {
    resumeIds = new Set(JSON.parse(await readFile(FAILED_PATH, "utf8")));
    console.log(`[backfill] resume: ${resumeIds.size} chunkIds`);
  } catch {
    console.error(`No resume file at ${FAILED_PATH}`);
    process.exit(1);
  }
}

let offset = 0;
const failed = [];
let totalSeen = 0;
let totalUpserted = 0;
let totalSkipped = 0;

while (true) {
  const embeddingRows = await db
    .select()
    .from(knowledgeChunkEmbeddings)
    .limit(PAGE_SIZE)
    .offset(offset);

  if (embeddingRows.length === 0) break;
  totalSeen += embeddingRows.length;

  const chunkIds = embeddingRows.map((r) => r.chunkId);
  const chunkRows = await db
    .select()
    .from(knowledgeChunks)
    .where(inArray(knowledgeChunks.id, chunkIds));
  const chunkMap = new Map(chunkRows.map((c) => [c.id, c]));

  const records = [];
  for (const row of embeddingRows) {
    if (resumeIds && !resumeIds.has(row.chunkId)) continue;
    const chunk = chunkMap.get(row.chunkId);
    if (!chunk) {
      // 孤儿 embedding（chunk 已删但 embedding 残留）— 跳过
      totalSkipped++;
      continue;
    }
    if (!chunk.userId) {
      // legacy chunk 没有 userId — 跳过（multi-tenant 隔离需要这个字段）
      totalSkipped++;
      continue;
    }
    const vector = vectorBufferToArray(row.vector);
    if (vector.length !== 384) {
      console.warn(
        `[backfill] dim mismatch ${row.chunkId}: ${vector.length}`
      );
      failed.push(row.chunkId);
      continue;
    }
    records.push({
      chunkId: row.chunkId,
      userId: chunk.userId,
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      vector,
    });
  }

  if (records.length > 0) {
    try {
      await store.upsertChunkVectors(records);
      totalUpserted += records.length;
      console.log(
        `[backfill] page offset=${offset}: upserted ${records.length} (累计 ${totalUpserted})`
      );
    } catch (err) {
      console.error(
        `[backfill] page offset=${offset} 全部失败: ${err.message}`
      );
      failed.push(...records.map((r) => r.chunkId));
    }
  }

  offset += PAGE_SIZE;
}

console.log(`\n[backfill] 完成:`);
console.log(`  Turso embeddings 总数 : ${totalSeen}`);
console.log(`  推到 Milvus 成功      : ${totalUpserted}`);
console.log(`  跳过（孤儿/无userId） : ${totalSkipped}`);
console.log(`  失败                  : ${failed.length}`);

if (failed.length > 0) {
  await writeFile(FAILED_PATH, JSON.stringify(failed, null, 2));
  console.error(`\n失败的 chunkId 写到 ${FAILED_PATH}，--resume 可重试。`);
  process.exit(1);
}
