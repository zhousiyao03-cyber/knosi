import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

import { marked } from "marked";
import MarkdownIt from "markdown-it";
import * as md from "markdown-wasm";

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(here, "..", "samples");

await md.ready;

const samples = [
  { label: "10KB", file: "small-10kb.md" },
  { label: "50KB", file: "medium-50kb.md" },
  { label: "200KB", file: "large-200kb.md" },
];

const mdIt = new MarkdownIt();

const parsers = [
  { name: "marked (JS)", fn: (src) => marked.parse(src) },
  { name: "markdown-it (JS)", fn: (src) => mdIt.render(src) },
  { name: "markdown-wasm (cmark wasm)", fn: (src) => md.parse(src) },
];

const WARMUP = 20;
const ITERATIONS = 200;

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

function run(parserFn, src) {
  for (let i = 0; i < WARMUP; i++) parserFn(src);
  const samples = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    parserFn(src);
    samples.push(performance.now() - t0);
  }
  return samples;
}

const results = [];
for (const s of samples) {
  const src = readFileSync(join(samplesDir, s.file), "utf8");
  console.log(`\n=== ${s.label} (${src.length} bytes) ===`);
  for (const p of parsers) {
    const times = run(p.fn, src);
    const med = median(times);
    const p95v = p95(times);
    const min = Math.min(...times);
    results.push({ size: s.label, parser: p.name, median: med, p95: p95v, min });
    console.log(`  ${p.name.padEnd(28)}  median=${med.toFixed(3)}ms  p95=${p95v.toFixed(3)}ms  min=${min.toFixed(3)}ms`);
  }
}

console.log("\n\n## Summary table\n");
console.log("| Size  | Parser                       | Median (ms) | p95 (ms) | Min (ms) |");
console.log("|-------|------------------------------|-------------|----------|----------|");
for (const r of results) {
  console.log(
    `| ${r.size.padEnd(5)} | ${r.parser.padEnd(28)} | ${r.median.toFixed(3).padStart(11)} | ${r.p95.toFixed(3).padStart(8)} | ${r.min.toFixed(3).padStart(8)} |`
  );
}

console.log("\n## Speedup vs marked (median)\n");
const bySize = {};
for (const r of results) {
  bySize[r.size] ??= {};
  bySize[r.size][r.parser] = r.median;
}
for (const [size, m] of Object.entries(bySize)) {
  const baseline = m["marked (JS)"];
  console.log(`### ${size}`);
  for (const [name, t] of Object.entries(m)) {
    const x = baseline / t;
    console.log(`  ${name.padEnd(28)}  ${x.toFixed(2)}×`);
  }
}
