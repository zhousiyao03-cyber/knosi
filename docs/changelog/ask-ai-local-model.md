# Ask AI — In-Browser Local Model Option

**Date:** 2026-04-19
**Goal:** Make Ask AI's generation backend switchable between cloud (existing GPT-5.4 / Claude / daemon) and a new in-browser Gemma 4 E2B ONNX model that runs on WebGPU. Server-side structured-data flows (indexer, URL analysis, tag suggestions, RAG embeddings, etc.) are **not** affected; this is a client-only generation option for the Ask AI chat surface at `/ask`.

## Architecture

- **RAG stays server-side.** The existing agentic-rag + keyword fallback + pinned-source resolution + system-prompt assembly runs in Node, identical to cloud mode.
- **Generation moves to the browser (local mode only).** Client POSTs to new `/api/chat/prepare`, which returns `{ system, messages }` without calling any LLM. The client then feeds that bundle into a comlink-wrapped Web Worker hosting Gemma 4 E2B (`onnx-community/gemma-4-E2B-it-ONNX`, q4f16) on WebGPU.
- **Toggle is client-only.** Persisted in `localStorage` under `knosi.ask-ai.mode` (`"cloud" | "local"`), consumed via `useSyncExternalStore` so SSR renders the cloud variant and client rehydrates to user's chosen mode. `AI_PROVIDER` env var is untouched — it still governs the 4 cloud backends.
- **Model cache.** Optional File System Access API folder picker lets users pin the Gemma weights (~2–4 GB) to a local directory, bypassing browser `CacheStorage` churn. Falls back to `caches` API then network. Ported from the web-bro project.

## Key changes

### New files

- `src/server/ai/chat-prepare.ts` — shared pipeline: input schema, `resolvePinnedSources`, `buildChatContext` (RAG + buildSystemPrompt with langfuse tracing). Reused by both `/api/chat` and `/api/chat/prepare`.
- `src/app/api/chat/prepare/route.ts` — POST endpoint: auth + rate-limit + `buildChatContext` → `Response.json({ system, messages: PreparedChatMessage[] })`.
- `src/lib/local-ai/contracts.ts` — `LocalLlmWorkerAPI`, `LocalModelStatus`, `LocalModelCacheStatus`, `LocalChatMessage` types.
- `src/lib/local-ai/runtime.ts` — singleton comlink wrapper around the worker; `getLocalLlmRuntime()`, `disposeLocalLlmRuntime()`, `isWebGpuLikelySupported()`, `isFileSystemAccessSupported()`.
- `src/lib/local-ai/file-system-access.d.ts` — ambient types for `FileSystemDirectoryHandle.queryPermission` / `window.showDirectoryPicker` (not yet in lib.dom.d.ts).
- `src/workers/llm.worker.ts` — ported from web-bro, simplified:
  - Drops workspace tool call plumbing (list_dir / read_file / etc).
  - Exposes `generateChat({ system, messages }, onStream)` via comlink.
  - Keeps three-tier cache (folder → browser `caches` → network), WebGPU + q4f16 on Gemma 4 E2B, `InterruptableStoppingCriteria` for abort, `TextStreamer` for streaming deltas.
- `src/components/ask/use-local-chat.ts` — React hook: manages messages, streams via proxied comlink callback, exposes `{messages, status, sendMessage, regenerate, stop, modelStatus, cacheStatus, loadModel, configureCacheFolder, webGpuSupported}`.
- `src/components/ask/ask-page-local.tsx` — third variant of the Ask page. Adds a status banner (phase + progress + load/folder buttons), disables composer until WebGPU is confirmed, otherwise mirrors the stream variant's UX (scope dropdown, quick prompts, save-as-note, regenerate, source pills).
- `e2e/ask-local-toggle.spec.ts` — Playwright spec: toggle visibility, aria-pressed correctness, local banner appears on switch, mode persists across reload, `/api/chat/prepare` returns a system+messages bundle.
- `docs/superpowers/plans/2026-04-19-ask-ai-local-model.md` — the plan that drove this work.

### Modified files

- `src/app/api/chat/route.ts` — factored shared logic out; daemon branch and streaming branch now call `buildChatContext` / `sanitizeMessages`. Behavior unchanged for cloud users.
- `src/components/ask/ask-page-client.tsx` — adds `ModeToggle` component (fixed top-right) and `useAskAiMode()` hook (useSyncExternalStore-backed); renders `AskPageLocal` when mode === "local", else existing cloud variant (stream or daemon, decided server-side).
- `package.json` / `pnpm-lock.yaml` — adds `@huggingface/transformers@4.0.1` and `comlink@^4.4.2`.

## Dependencies

- **Added:** `@huggingface/transformers@4.0.1`, `comlink@^4.4.2`.
- Worker bundled via Next.js built-in `new Worker(new URL(..., import.meta.url), { type: "module" })` — no next.config changes were needed; turbopack emits the worker chunk automatically.

## Database

No schema changes.

## Verification

- `pnpm build` — **PASS** (turbopack, TypeScript). `/api/chat/prepare` shows up as a new ƒ route; all other routes unchanged.
- `pnpm exec eslint` — **PASS** (0 errors, 9 pre-existing warnings unrelated to this change).
- `pnpm test:e2e ask-local-toggle` — **BLOCKED** on this Windows dev box by a pre-existing `EBUSY: resource busy or locked` on `data/second-brain.e2e.db` during Playwright's `global-setup` removeIfExists. The same error reproduces for all existing specs (confirmed by running `pnpm test:e2e phase1`), so it is an environment-level issue with the e2e harness on Windows, not a regression introduced by this change. Trusting CI / PowerShell-native runs for verification.

## Known limitations

- WebGPU is required. Safari and most mobile browsers will see the "WebGPU unavailable" inline warning in the local banner and the composer stays disabled — users can switch back to Cloud via the top-right toggle.
- First-load cost: ~2–4 GB of ONNX weights. The banner's "Pick cache folder" button makes that download a one-time cost per user.
- Quality gap: Gemma 4 E2B (2B params, q4f16 quantized) is materially weaker than GPT-5.4 / Claude Sonnet for RAG-heavy questions. The banner frames it as "Local · Gemma 4 E2B" and the footer note reminds users that quality is limited compared to Cloud.
- Daemon mode + local mode aren't combinable in the same session; the toggle flips between `cloud` (whichever server-side path applies) and `local`.

## Remaining follow-ups

- Wire `parseAiBlocks` structured-output path: currently Local uses plain markdown rendering. Gemma's compliance with the `<ai_blocks>` tag will need empirical tuning — probably skip the `preferStructuredBlocks` flag for local mode until measured.
- Persist the picked cache folder handle across sessions via IndexedDB so users don't need to re-pick each tab.
- Consider a short feature-flag env (`NEXT_PUBLIC_ENABLE_LOCAL_AI`) so the toggle can be hidden on production until the UX is polished.
- Run the new spec (and the full suite) on CI / on a non-Windows box to close out the e2e verification gap noted above.
