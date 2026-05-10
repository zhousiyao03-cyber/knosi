# 2026-05-10 — In-browser full-text search via wasm (minisearch-rs)

## What landed

Cmd+K can now run the entire search pipeline in the browser using a
Rust+wasm BM25 engine, with the existing server-side `LIKE` search kept
as a fallback toggle.

- New tRPC endpoint `notes.dumpForIndex` returns
  `{ id, title, plainText, updatedAt }` for every note that has plain
  text. Used by the client to build a local index in one round trip.
- `vendor/minisearch-rs` added as a git submodule pointing at
  [minisearch-rs](https://github.com/zhousiyao03-cyber/minisearch-rs).
  Pre-built `pkg/` is committed in the submodule so the runtime works
  without `wasm-pack` on the consumer's machine.
- `public/wasm/{minisearch_rs.js,minisearch_rs_bg.wasm,*.d.ts}` —
  copies of the submodule's `pkg/` artifacts, served by Next.js as
  static assets at `/wasm/...`. Refresh procedure documented in
  `public/wasm/README.md`.
- `src/components/local-search/` — new client module:
  - `idb-cache.ts`: tiny IndexedDB wrapper that persists the encoded
    index per user, keyed by `userId`. Cache is reused if the doc
    count + freshest `updatedAt` match (otherwise a full rebuild runs
    in the background).
  - `provider.tsx`: `LocalSearchProvider` + `useLocalSearch()` hook.
    Loads wasm via `Function("u","return import(u)")` to bypass
    bundler resolution (works under both webpack and turbopack).
- `src/components/search-dialog.tsx` — owns the `localEnabled` flag in
  `localStorage`, conditionally mounts `LocalSearchProvider`. Wasm is
  only fetched after the user enables the toggle and opens the
  dialog.
- `src/components/search-dialog-modal.tsx` — adds the toggle row and a
  snippet preview line under each hit (when running locally).
- `eslint.config.mjs` — ignores `vendor/**` and `public/wasm/**` so
  generated wasm-bindgen JS doesn't trip our lint rules.

## How it works

1. User opens Cmd+K, ticks "Full-text (in-browser)" — we persist the
   preference in `localStorage`.
2. `LocalSearchProvider` mounts, fetches `notes.dumpForIndex` (one
   request, ~few hundred KB for 100-1000 notes).
3. We import `/wasm/minisearch_rs.js`, instantiate the wasm module
   (~187 KB pre-`wasm-opt`, expected to drop to ~70 KB once
   `binaryen` is wired up).
4. We feed each `(id, title+plainText)` into `JsEngine.addDocument`
   (title is repeated once for a small ranking boost).
5. We persist `engine.toBytes()` into IndexedDB so the next session
   skips rebuild.
6. Subsequent queries call `engine.search(query, 10, corpus)` — BM25
   ranking, sub-millisecond on 100-1000 doc corpora, with snippets
   that point at exact byte ranges in the original text.
7. If wasm load or fetch fails for any reason, the dialog silently
   falls back to the server `dashboard.search` LIKE path.

## Verification

- `pnpm build` — passes (Next.js 16.2.1 + Turbopack)
- `pnpm lint` — 0 new findings introduced by this change. The 30
  pre-existing `react-hooks/set-state-in-effect` errors / unused-var
  warnings are unrelated and tracked separately.
- `pnpm test:e2e` — **not run.** Local `pnpm dev` ran into a
  pre-existing `[auth] MissingSecret` error (the local
  `.env.local` is missing `AUTH_SECRET`); this affects every page
  load, not just the search dialog, and is not introduced by this
  change. End-to-end browser verification needs to happen on a
  machine with a working `AUTH_SECRET`.

## Known follow-ups

- Hook up `binaryen` (e.g. `brew install binaryen`) and re-enable
  `wasm-opt` in `vendor/minisearch-rs/Cargo.toml` to drop the wasm
  bundle from 187 KB → ~70 KB.
- IndexedDB cache is invalidated on _any_ note edit (`freshAs`
  comparison). For users with very high edit cadence we could move
  to incremental updates by hooking `notes.update` mutations.
- The current snippet pipeline duplicates the title in the indexed
  body for ranking. If we ever surface raw `plainText` for snippets
  instead of `title + plainText`, we'd want to dedupe.
- Add a Playwright e2e once the auth secret blocker is sorted.

## Files

```
.gitmodules                                          (new)
vendor/minisearch-rs                                  (new submodule)
public/wasm/minisearch_rs.js                          (new, ~23 KB)
public/wasm/minisearch_rs_bg.wasm                     (new, ~187 KB)
public/wasm/minisearch_rs.d.ts                        (new)
public/wasm/minisearch_rs_bg.wasm.d.ts                (new)
public/wasm/README.md                                 (new)
src/components/local-search/idb-cache.ts              (new)
src/components/local-search/provider.tsx              (new)
src/components/search-dialog.tsx                      (modified)
src/components/search-dialog-modal.tsx                (modified)
src/server/routers/notes.ts                           (modified)
eslint.config.mjs                                     (modified)
docs/changelog/2026-05-10-local-search-wasm.md        (new)
```
