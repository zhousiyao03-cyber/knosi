# 2026-04-19 — Split `ai/provider.ts` by backend

## Task / Goal

`src/server/ai/provider.ts` had ballooned to 919 lines holding four
distinct AI backend strategies (local Ollama / OpenAI / Codex OAuth /
Claude-code daemon) plus public dispatchers, identity helpers, and
shared JSON-prompt utilities in one file. Any change to one backend
dragged diffs through unrelated code. Split into a `provider/` directory
with one file per backend and a thin public façade (`index.ts`) that
dispatches by mode.

## Key Changes

- New directory `src/server/ai/provider/` with 8 files:
  - `types.ts` — shared types (`AIProviderMode`, `GenerationKind`,
    option shapes, Codex profile/auth/SSE types)
  - `shared.ts` — env/file helpers (`resolveValue`, `readJsonFile`),
    message text extraction, `buildStructuredJsonPrompt`,
    `extractJsonObject`
  - `mode.ts` — `getProviderMode` + openclaw/codex auth probing
    (`readOpenclawConfig`, `resolveCodexProfileId`,
    `resolveCodexAuthStorePath`, `readCodexAuthStore`)
  - `ai-sdk.ts` — local + openai path via `@ai-sdk/openai`:
    `createAiSdkProvider`, `resolveAiSdkModelId`, `streamChatAiSdk`,
    `generateStructuredDataAiSdk`
  - `codex.ts` — the Codex OAuth + SSE streaming + structured JSON
    path. Biggest single file in the split.
  - `daemon.ts` — `claude-code-daemon` structured path that enqueues a
    `chatTasks` row and polls for completion
  - `identity.ts` — `getAISetupHint`, `getChatAssistantIdentity`,
    `getAIErrorMessage`
  - `index.ts` — public dispatchers (`streamChatResponse`,
    `generateStructuredData`) and re-exports from identity
- Deleted the old single-file `src/server/ai/provider.ts`.
- No consumer imports changed: all 5 call sites keep
  `from "@/server/ai/provider"` which now resolves to
  `provider/index.ts`.

## Files Touched

- Added:
  `src/server/ai/provider/{types,shared,mode,ai-sdk,codex,daemon,identity,index}.ts`
- Deleted: `src/server/ai/provider.ts`

## Verification

- `pnpm build` → ✅ Next.js builds all routes, TypeScript accepts every
  downstream import.
- `pnpm lint` (via direct `./node_modules/.bin/eslint`) → ✅ 0 errors,
  same 9 pre-existing warnings as before the split (none in the new
  files).
- `pnpm test:e2e` → ❌ same pre-existing Windows `EBUSY: resource busy
  or locked` failure in `e2e/global-setup.ts`. Reproducible on `main`
  without any of my changes. Not related to this refactor.

## Remaining Risks / Follow-ups

- The Windows e2e environment issue remains a standing follow-up item
  (see 2026-04-19-split-schema-by-domain.md). Not addressed here.
- No behavior change: the split preserves every function body
  verbatim; the only edits are moving the `mode` parameter to the
  per-backend implementations and letting `index.ts` inject it.
- Next in the refactor series: split
  `src/server/integrations/oauth.ts` (789 lines), then unify
  `cache.ts` + `redis-cache.ts`.
