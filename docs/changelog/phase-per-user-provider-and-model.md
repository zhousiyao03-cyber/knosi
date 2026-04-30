# Phase 1.5 — Per-User Provider & Model Selection

Date: 2026-04-30
Spec: `docs/specs/2026-04-30-per-user-provider-and-model-design.md`

## Summary

The Settings UI provider selector now actually routes Ask AI requests
through the user's chosen backend instead of being purely cosmetic, and
each user can pick (or type) a chat model that overrides the deployment
default. Both pieces of state live on `users.aiProviderPreference` /
`users.aiChatModel`, are cached in-process for 30s, and are invalidated
the moment the user saves a change so the next chat request reflects it.

## Completed

- `users.aiChatModel` column added to `auth.ts` schema (free-text,
  nullable).
- `getProviderMode()` is now async and accepts `{ userId? }`. Resolution
  order matches spec §3.3: user pref → `AI_PROVIDER` env →
  auto-detect (codex profile → openai key → local).
  `"knosi-hosted"` user pref maps to underlying `"codex"` mode.
- `getProviderModeSync()` is exported alongside the async one for
  `identity.ts`, which deliberately stays sync (spec §3.6 step 3) so the
  system-prompt assembly chain doesn't need to flip async.
- `resolveAiSdkModelId()` is now async and accepts `{ userId? }`. Reads
  `users.aiChatModel` for `kind === "chat"` only — `task` always uses
  env / built-in. `resolveAiSdkModelIdSync()` companion drops the user
  branch for identity callers.
- Per-user pref + chat-model are cached together (one `Map<userId, row>`
  with 30s TTL, capped at 1000 entries with insertion-order eviction).
  `invalidateProviderPrefCache(userId)` flushes a single entry.
- All 5 call sites identified in spec §3.6 await + thread `userId`:
  `route.ts`, `provider/index.ts` (×2), `provider/ai-sdk.ts` (×1
  helper), trpc mutations.
- `streamChatAiSdk` returns `{ response, modelId }` so the chat route can
  attach the resolved model id as a response header without re-resolving.
- `streamChatResponse` returns `{ response, modelId }`. Codex / hosted /
  daemon paths report `modelId: null` (those backends pick their model
  internally; debug header for them only carries `X-Knosi-Mode`).
- New tRPC: `billing.getAiChatModel` + `billing.setAiChatModel` (free
  text, capped at 200 chars, no `/v1/models` validation per spec §2).
  Both `setAiProviderPreference` and `setAiChatModel` call
  `invalidateProviderPrefCache(userId)`.
- `ai-provider-section.tsx` now wraps each provider option in a div +
  inline `<label htmlFor>` so the embedded `ModelPicker` is not
  swallowed by an outer label. The picker is mounted only under the
  currently-selected provider (spec §3.5).
- New `settings/model-picker.tsx`: radio list of curated presets per
  provider + "Use deployment default" + "Custom…" inline text input.
  Custom commits via Save button or Enter. State lives in two flags
  (`showCustomInput`, `customDraft`) — derived `radio` selection
  avoids `useEffect`-driven setState (which triggered the
  `react-hooks/set-state-in-effect` lint error in the first iteration).
- `route.ts` adds `X-Knosi-Mode` and (for AI-SDK paths) `X-Knosi-Model`
  response headers via a `withDebugHeaders` helper that re-emits the
  streaming Response with the SSE body passed straight through. Spec
  §6.2.
- `experimental_telemetry.metadata` on both `streamText` and
  `generateText` now includes `model: modelId` so Langfuse model-mix
  analysis is possible. Spec §6.3.
- Daemon path is untouched. `shouldUseDaemonForChat()` keeps reading
  `AI_PROVIDER` env (spec §3.8 / §2 non-goal). The route `mode` decision
  for tool-calling (`mode === "openai" || mode === "local"`) does honor
  per-user pref because it now reads the new async `getProviderMode`.

## New / modified files

### Source

- `src/server/db/schema/auth.ts` — `aiChatModel` column
- `src/server/ai/provider/mode.ts` — async + cache + sync companion
- `src/server/ai/provider/ai-sdk.ts` — async resolver + ctx threading +
  return-shape change to `{ response, modelId }`
- `src/server/ai/provider/identity.ts` — switched to sync helpers
- `src/server/ai/provider/index.ts` — `streamChatResponse` returns
  `{ response, modelId }`; awaits `getProviderMode({ userId })`
- `src/server/routers/billing.ts` — new procs + cache invalidation
- `src/app/api/chat/route.ts` — `withDebugHeaders` + new return shape
- `src/app/(app)/settings/ai-provider-section.tsx` — embed
  `ModelPicker`, restructure label DOM
- `src/app/(app)/settings/model-picker.tsx` — new

### Tests

- `src/server/ai/provider/mode.test.ts` — new (12 cases)
- `src/server/ai/provider/ai-sdk.test.ts` — new (8 cases)
- `e2e/per-user-provider.spec.ts` — new (5 cases, serial mode)

### Migrations

- `drizzle/0041_optimal_famine.sql` — `ALTER TABLE users ADD COLUMN ai_chat_model text`
- `drizzle/meta/0041_snapshot.json`
- `drizzle/meta/_journal.json` updated

## Database changes

```sql
ALTER TABLE users ADD COLUMN ai_chat_model text;
```

## Production rollout

`drizzle-kit push` against the production Turso URL was unreliable
(spinner hung in the schema-pull phase, similar to past observations on
this large DB), so the rollout went directly through `@libsql/client`:

```js
// One-shot script (deleted after run; commands kept here for the record):
const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
const before = await client.execute(
  "SELECT name FROM pragma_table_info('users') WHERE name='ai_chat_model'",
);
if (before.rows.length === 0) {
  await client.execute("ALTER TABLE users ADD COLUMN ai_chat_model text");
}
const after = await client.execute(
  "SELECT name FROM pragma_table_info('users') WHERE name='ai_chat_model'",
);
console.log(after.rows);
```

### Verification result (live prod Turso)

```
Before: []
Adding ai_chat_model column...
ALTER TABLE OK
After: [{"name":"ai_chat_model"}]
OK: ai_chat_model column verified on production Turso.
Users table schema:
   id TEXT
   name TEXT
   email TEXT
   email_verified INTEGER
   image TEXT
   created_at INTEGER
   ai_provider_preference TEXT
   ai_chat_model TEXT
```

## Verification

- `pnpm build`: pass (Node 22.11.0).
- `pnpm lint`: 11 errors / 14 warnings remain — all pre-existing on `main`
  (analysis-prompts-section / use-local-chat / tiptap-editor:
  `react-hooks/refs` and `set-state-in-effect`). The first iteration of
  `model-picker.tsx` triggered the same rule and was rewritten to derive
  `radio` instead of syncing it via effect; current iteration has zero
  lint findings on the files touched in this phase.
- `pnpm test:unit src/server/ai/provider/`: 20 / 20 pass.
- `pnpm test:unit` (whole repo): 191 / 192 pass; the lone failure is
  `safe-fetch.test.ts` IPv6 lookup (pre-existing dev-host networking
  flake — `getaddrinfo ENOTFOUND [::1]` — unrelated to this phase).
- `pnpm test:e2e --project=default --grep "Per-user provider"`: 5 / 5
  pass (serial).
- `pnpm test:e2e --project=default` (whole default project): the
  `ask-ai-mention.spec.ts` 2 cases that fail on a clean `main` checkout
  also fail here — confirmed unrelated by stashing my changes and
  re-running; reproduces identically. Not introduced by this phase.

## Known issues / follow-up

- `identity.ts` deliberately ignores per-user provider/model preference
  (spec §3.6 step 3). The "I am running on X" identity line in the chat
  system prompt is therefore always the deployment default, not the
  user-chosen one. This is a documented trade-off, not a bug.
- Daemon path is unchanged: a user picking "Claude Code Daemon" in
  Settings only takes effect if the deployment also has `AI_PROVIDER=
  claude-code-daemon` and a daemon process running. Otherwise the
  existing "AI daemon not set up yet" banner kicks in. Spec §3.8.
- `task` kind never reads user-saved model — structured-data generation
  uses deployment defaults for parser-stability reasons (spec §3.4).
- `X-Knosi-Model` header is only emitted on the AI-SDK path; codex /
  hosted-pool / daemon don't surface a model id at this layer. Spec §6.2.
- `ask-ai-mention.spec.ts` flake is pre-existing; not in scope.
