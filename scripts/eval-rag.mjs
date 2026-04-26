#!/usr/bin/env node
// RAG eval harness — 跑预先标注的 query 集合，输出 recall@5 / recall@10 / MRR
//
// Usage:
//   node --experimental-strip-types --env-file=.env.local scripts/eval-rag.mjs
//   node ... scripts/eval-rag.mjs --ef 32 --out eval/results/ef-32.json
//   node ... scripts/eval-rag.mjs --seed-template       # 列候选给你手填 ground truth
//   node ... scripts/eval-rag.mjs --user <id>           # 指定用户（默认 EVAL_USER_ID env）
//
// 备注：本机 Node 20 不支持 --experimental-strip-types；用 Node 22+ 跑，
// 或者临时把 .ts 文件改成相对路径 .js（agentic-rag 是 .ts，没法绕开）。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const SEED_MODE = args.includes("--seed-template");
const EF = getArg("--ef", null);
const TOP_K = Number(getArg("--top-k", 16));
const OUT_PATH = getArg("--out", null);
const USER_ID = getArg("--user", process.env.EVAL_USER_ID);

if (EF) process.env.MILVUS_SEARCH_EF = EF;

if (!USER_ID) {
  console.error(
    "Set EVAL_USER_ID env var or pass --user <id>. " +
      "用 sqlite3 data/second-brain.db 'SELECT id FROM users LIMIT 1;' 查你的 user id。"
  );
  process.exit(1);
}

const groundTruthPath = resolve(repoRoot, "eval/ground-truth.json");
let groundTruth;
try {
  groundTruth = JSON.parse(await readFile(groundTruthPath, "utf8"));
} catch (err) {
  console.error(`无法读取 ${groundTruthPath}: ${err.message}`);
  process.exit(1);
}

const { retrieveAgenticContext } = await import(
  resolve(repoRoot, "src/server/ai/agentic-rag.ts")
);

if (SEED_MODE) {
  console.log(
    "\n=== Seed mode：列每个 query 的 BM25+ANN 候选，手填 ground-truth.json 的 relevant_chunk_ids ==="
  );
  for (const q of groundTruth.queries) {
    console.log(`\n[${q.id}] ${q.query}`);
    try {
      const results = await retrieveAgenticContext(q.query, { userId: USER_ID });
      for (const r of results.slice(0, 10)) {
        const preview = r.content.replace(/\s+/g, " ").slice(0, 90);
        console.log(`  ${r.chunkId}  ${r.sourceTitle}  | ${preview}`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }
  process.exit(0);
}

const perQuery = [];
for (const q of groundTruth.queries) {
  if (!q.relevant_chunk_ids || q.relevant_chunk_ids.length === 0) {
    console.warn(`[skip] ${q.id} 没有 relevant_chunk_ids 标注`);
    continue;
  }

  const t0 = Date.now();
  let results;
  try {
    results = await retrieveAgenticContext(q.query, { userId: USER_ID });
  } catch (err) {
    console.error(`[error] ${q.id}: ${err.message}`);
    continue;
  }
  const latencyMs = Date.now() - t0;

  const ranked = results.map((r) => r.chunkId);
  const relevant = new Set(q.relevant_chunk_ids);

  const top5 = ranked.slice(0, 5);
  const top10 = ranked.slice(0, 10);

  const recall5 =
    [...relevant].filter((id) => top5.includes(id)).length / relevant.size;
  const recall10 =
    [...relevant].filter((id) => top10.includes(id)).length / relevant.size;
  const firstRelevantIndex = ranked.findIndex((id) => relevant.has(id));
  const mrr = firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;

  perQuery.push({
    id: q.id,
    query: q.query,
    recall5,
    recall10,
    mrr,
    latencyMs,
    rankedTopK: ranked.slice(0, TOP_K),
    relevant: q.relevant_chunk_ids,
  });
}

if (perQuery.length === 0) {
  console.error(
    "\n没有标注的 query 可以跑。先 `--seed-template` 然后填 ground-truth.json。"
  );
  process.exit(1);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sortedLatencies = [...perQuery.map((q) => q.latencyMs)].sort((a, b) => a - b);
const aggregate = {
  n: perQuery.length,
  recall5: mean(perQuery.map((q) => q.recall5)),
  recall10: mean(perQuery.map((q) => q.recall10)),
  mrr: mean(perQuery.map((q) => q.mrr)),
  p50LatencyMs: sortedLatencies[Math.floor(sortedLatencies.length / 2)],
  p95LatencyMs:
    sortedLatencies[Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.95))],
};

console.log(
  `\nEval run @ ${new Date().toISOString()} (ef=${EF ?? "default"}, top-k=${TOP_K}, n=${aggregate.n})\n`
);
console.log("ID       Query                          Recall@5  Recall@10  MRR     Latency");
console.log("-------- ------------------------------ --------  ---------  ------  -------");
for (const r of perQuery) {
  const id = r.id.padEnd(8);
  const q = r.query.slice(0, 30).padEnd(30);
  console.log(
    `${id} ${q} ${r.recall5.toFixed(3).padStart(8)}  ${r.recall10.toFixed(3).padStart(9)}  ${r.mrr.toFixed(3).padStart(6)}  ${(r.latencyMs + "ms").padStart(7)}`
  );
}
console.log("\nAggregate:");
console.log(`  Recall@5     : ${aggregate.recall5.toFixed(3)}`);
console.log(`  Recall@10    : ${aggregate.recall10.toFixed(3)}`);
console.log(`  MRR          : ${aggregate.mrr.toFixed(3)}`);
console.log(`  p50 latency  : ${aggregate.p50LatencyMs}ms`);
console.log(`  p95 latency  : ${aggregate.p95LatencyMs}ms`);

const outPath =
  OUT_PATH ??
  resolve(
    repoRoot,
    `eval/results/run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ aggregate, perQuery }, null, 2));
console.log(`\n保存到 ${outPath}`);
