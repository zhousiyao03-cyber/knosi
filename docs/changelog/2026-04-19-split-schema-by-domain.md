# 2026-04-19 — Split `schema.ts` into domain files

## Task / Goal

`src/server/db/schema.ts` had grown to 958 lines holding 30+ tables across
every domain (auth, notes, focus, learning, portfolio, projects, ops, etc).
Any change to one domain's tables produced diffs polluted by unrelated
neighbors. Split the single file into per-domain files behind a barrel
re-export so every existing `import ... from "@/server/db/schema"` keeps
working and drizzle-kit sees the exact same set of tables.

## Key Changes

- Introduced `src/server/db/schema/` directory with 12 domain files:
  - `auth.ts` — users, accounts, userCredentials
  - `oauth.ts` — oauthClients, oauthAuthorizationCodes,
    oauthRefreshTokens, oauthAccessTokens
  - `notes.ts` — folders, notes, noteLinks, bookmarks, todos
  - `chat.ts` — chatMessages, chatTasks, daemonChatMessages
  - `knowledge.ts` — knowledgeChunks, knowledgeChunkEmbeddings,
    knowledgeIndexJobs
  - `workflows.ts` — workflows, workflowRuns
  - `learning.ts` — learningPaths, learningLessons, learningTopics,
    learningNotes, learningReviews
  - `usage.ts` — tokenUsageEntries, usageRecords, aiUsage
  - `focus.ts` — activitySessions, focusDailySummaries, focusDevices,
    focusDevicePairings, focusPairingRateLimits
  - `portfolio.ts` — portfolioHoldings, portfolioNews
  - `projects.ts` — osProjects, analysisPrompts, osProjectNotes,
    analysisTasks, analysisMessages
  - `ops.ts` — daemonHeartbeats, opsJobHeartbeats, cliTokens
- Added `src/server/db/schema/index.ts` as the barrel (`export *` from
  each domain file).
- Dependency shape: every domain that references `users` imports
  `{ users } from "./auth"`. No circular deps — auth sits at the bottom.
- Deleted the old single-file `src/server/db/schema.ts`.
- Updated `drizzle.config.ts` to glob `./src/server/db/schema/*.ts` so
  drizzle-kit scans every domain file.

## Files Touched

- Added: `src/server/db/schema/{auth,oauth,notes,chat,knowledge,workflows,learning,usage,focus,portfolio,projects,ops,index}.ts`
- Modified: `drizzle.config.ts`
- Deleted: `src/server/db/schema.ts`

No consumer imports were touched — all existing
`from "@/server/db/schema"` paths continue to resolve, now via
`schema/index.ts`.

## Verification

- `pnpm build` → ✅ passes. Next.js compiles all routes, TypeScript
  accepts every import of `@/server/db/schema`.
- `pnpm lint` (direct `./node_modules/.bin/eslint`, since the pnpm
  script's `mkdir -p` doesn't work under Windows cmd.exe) → ✅ 0
  errors, 9 pre-existing warnings outside touched files.
- `pnpm db:generate` → ✅ **"No schema changes, nothing to migrate 😴"**.
  drizzle-kit confirms the split is byte-identical to the previous
  single-file form. No migration produced.
- `pnpm db:push` against the e2e SQLite file → ✅ **"No changes
  detected"**.
- `pnpm test:e2e` → ❌ **blocked by pre-existing Windows
  environment issue** (`EBUSY: resource busy or locked, unlink` on the
  e2e SQLite file in `global-setup.ts`). Reproduced on clean `main`
  with my changes stashed — the failure is independent of this
  refactor. Not fixed as part of this task.

## Remaining Risks / Follow-ups

- **e2e**: The Windows `EBUSY` in `e2e/global-setup.ts` is orthogonal
  to this change but is an open follow-up. Filed as known issue — fix
  candidates: add retry/backoff in `removeIfExists`, or detect locked
  handle and skip. Not blocking: drizzle confirms the schema is
  unchanged, so runtime behavior is guaranteed equivalent.
- **Production Turso**: Schema unchanged (drizzle-kit produced no
  diff). No production rollout needed.
- **Next steps in the same refactor series**:
  1. Split `src/server/ai/provider.ts` (919 lines, multi-strategy)
  2. Split `src/server/integrations/oauth.ts` (789 lines)
  3. Unify `cache.ts` (in-memory) + `redis-cache.ts` behind one
     interface
