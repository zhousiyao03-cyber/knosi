# public/wasm/

WebAssembly artifacts for the client-side full-text search engine
(`minisearch-rs`). These files are imported dynamically by
`src/components/local-search/` and served as static assets by Next.js
at `/wasm/...`.

## Sync from submodule

The source is the `vendor/minisearch-rs` submodule. To refresh after
upgrading the submodule:

```bash
git submodule update --remote vendor/minisearch-rs
cp vendor/minisearch-rs/pkg/minisearch_rs_bg.wasm     public/wasm/
cp vendor/minisearch-rs/pkg/minisearch_rs.js          public/wasm/
cp vendor/minisearch-rs/pkg/minisearch_rs.d.ts        public/wasm/
cp vendor/minisearch-rs/pkg/minisearch_rs_bg.wasm.d.ts public/wasm/
```

## Files

| File | Size | Purpose |
|------|------|---------|
| `minisearch_rs_bg.wasm` | ~187 KB | The wasm module (BM25 engine) |
| `minisearch_rs.js` | ~23 KB | wasm-bindgen JS glue |
| `*.d.ts` | small | TypeScript declarations |
