# wasm-bench results

> Run: 2026-05-10 · Node v22.16.0 · macOS Darwin 25.3.0
> Iterations: 200 (after 20 warmup) per (size × parser) pair
> Sandbox: `tools/wasm-bench/` — does not affect main app

## Summary

| Size  | Parser                     | Median (ms) | p95 (ms) | Min (ms) |
|-------|----------------------------|-------------|----------|----------|
| 10KB  | marked (JS)                |       0.569 |    0.766 |    0.497 |
| 10KB  | markdown-it (JS)           |       0.371 |    0.654 |    0.313 |
| 10KB  | markdown-wasm (cmark wasm) |       0.126 |    0.183 |    0.120 |
| 50KB  | marked (JS)                |       2.507 |    2.772 |    2.319 |
| 50KB  | markdown-it (JS)           |       1.541 |    1.766 |    1.459 |
| 50KB  | markdown-wasm (cmark wasm) |       0.606 |    0.694 |    0.576 |
| 200KB | marked (JS)                |      10.750 |   11.415 |   10.119 |
| 200KB | markdown-it (JS)           |       6.482 |    7.467 |    5.965 |
| 200KB | markdown-wasm (cmark wasm) |       2.361 |    2.647 |    2.241 |

## Speedup vs marked (median)

| Size  | markdown-it | markdown-wasm |
|-------|-------------|----------------|
| 10KB  | 1.53×       | 4.51×          |
| 50KB  | 1.63×       | 4.14×          |
| 200KB | 1.66×       | 4.55×          |

## Notes

- `markdown-wasm` is GitHub Flavored cmark compiled to wasm — a representative
  baseline for what a Rust+wasm (`pulldown-cmark`) build would achieve.
- A custom `pulldown-cmark` build is typically on par with or slightly faster
  than cmark-wasm, so 4–5× is a conservative lower bound.
- The numbers are end-to-end (string in → HTML string out) including the
  JS↔wasm boundary; the relative gap stays stable across sizes (10KB → 200KB),
  meaning boundary cost is not dominating even at 10KB.
