# Ask AI — In-Browser Local Model Option

> For agentic workers: execute inline, verify with `pnpm build` + `pnpm lint` + targeted E2E. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a third "Local (Gemma 4, in-browser)" option to Ask AI that runs fully in a Web Worker on WebGPU, switchable from the current cloud (stream/daemon) options via a client-side toggle.

**Architecture:** Server keeps RAG + system-prompt assembly. New `/api/chat/prepare` returns `{ system, messages }` JSON (no streaming, no LLM call). Client in local mode forwards that bundle to a comlink-wrapped Web Worker that hosts the Gemma 4 E2B ONNX model (`onnx-community/gemma-4-E2B-it-ONNX`) on WebGPU, streaming deltas back to the UI. Toggle stored in `localStorage`. Cloud modes untouched.

**Tech Stack:** `@huggingface/transformers@4.0.1`, `comlink@^4.4.2`, Next.js 16 built-in worker URL support, File System Access API for optional model folder cache.

---

## Task 1 — Install dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] `pnpm add @huggingface/transformers@4.0.1 comlink@^4.4.2`

## Task 2 — Extract shared prepare helper

**Files:**
- Create: `src/server/ai/chat-prepare.ts`
- Modify: `src/app/api/chat/route.ts`

Factor auth + rate-limit + RAG + pinned sources + `buildSystemPrompt` into `preparePromptBundle({ req, body, userId }) → { system, messages }`. Route handler uses it, then calls `streamChatResponse`. New `prepare` route will reuse it.

## Task 3 — Add `/api/chat/prepare` endpoint

**Files:** `src/app/api/chat/prepare/route.ts`

Call shared helper, return `Response.json({ system, messages })`. Same auth/rate-limit as main route. Accept same input schema minus things that only matter server-side.

## Task 4 — Port LLM worker

**Files:**
- Create: `src/workers/llm.worker.ts`
- Create: `src/lib/local-ai/contracts.ts`

Simplified from web-bro — drop workspace tool definitions, keep model loading, folder-backed cache, and a `generateChat(messages, onStream)` method that uses `apply_chat_template`.

## Task 5 — Local AI runtime

**Files:** `src/lib/local-ai/runtime.ts`

comlink wrap of worker, singleton, `getLocalRuntime()` / `disposeLocalRuntime()`.

## Task 6 — useLocalChat hook

**Files:** `src/components/ask/use-local-chat.ts`

POST to `/api/chat/prepare`, feed `{system, messages}` to worker.generateChat, stream via comlink proxied callback, expose `{messages, status, sendMessage, stop, reset, error, modelStatus, cacheStatus}`.

## Task 7 — AskPageLocal component

**Files:** `src/components/ask/ask-page-local.tsx`

Variant of AskPageStream using `useLocalChat`. Adds:
- Model load button + progress bar
- Folder-picker button for persistent model cache
- Disabled submit when model not ready
- Error surface for WebGPU unavailable

## Task 8 — Mode toggle in AskPageClient

**Files:** `src/components/ask/ask-page-client.tsx`

- Add client-side toggle (Cloud / Local) in header, store in `localStorage` key `ask-ai-mode`
- When `local`, render `AskPageLocal`, else existing cloud variant (stream/daemon by server prop)
- Toggle hidden/disabled on SSR until mounted

## Task 9 — Next.js config for worker

**Files:** `next.config.ts` (if needed)

Worker file uses `new Worker(new URL('./llm.worker.ts', import.meta.url))` which Next.js/webpack supports. Only adjust if build fails — no upfront changes.

## Task 10 — Verification

- [ ] `pnpm build` — no TS errors
- [ ] `pnpm lint` — no lint errors
- [ ] E2E: `e2e/ask-local-toggle.spec.ts` — toggle visible, clicking Local shows setup UI, Cloud still works
- [ ] Changelog entry at `docs/changelog/phase-ask-ai-local-model.md`
- [ ] Commit: `feat(ask): add in-browser Gemma local model option`

## Risks / Known limits

- WebGPU not guaranteed in Playwright — E2E skips actual generation.
- First load downloads ~2GB of ONNX weights; folder cache optional.
- Safari / mobile without WebGPU will see error state gracefully — toggle lets them fall back to Cloud.
