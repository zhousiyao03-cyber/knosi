## 2026-03-30

### Task / Goal

Start the first browser-semantics rollout for Focus Tracker so browser sessions can carry structured meaning beyond raw app name and URL.

### Key Changes

- Added desktop-side browser semantics extraction in Rust:
  - `browser_host`
  - `browser_path`
  - `browser_search_query`
  - `browser_surface_type`
- Implemented a first-pass classifier for:
  - Google Search
  - GitHub repo / PR / issue
  - Chat tools
  - Docs
  - Figma design pages
  - Mail
  - Calendar
  - Video
- Extended desktop `EnrichedSample` and `QueuedSession` payloads so these fields upload with every browser session.
- Extended server `activity_sessions` schema and generated a migration adding the four semantic columns.
- Updated ingest and status routes to accept and return semantic browser fields.
- Updated Web focus presentation to prefer semantic labels such as:
  - `Search: ...`
  - `GitHub PR review`
  - `Documentation`
  instead of defaulting to raw browser app names everywhere.
- Updated server-side display-session grouping so semantic keys affect block merging:
  - distinct Google queries stay separate
  - the same PR can merge back across a short interruption
  - display sessions now emit a server-owned `displayLabel`
- Extended known-site coverage and AI usage of semantics:
  - added Perplexity search detection
  - added Linear / Jira-style issue detection
  - session classification now receives browser page title, search query, surface type, and display label context
  - daily summary now summarizes semantic display sessions instead of only raw sessions

### Files Touched

- `focus-tracker/src-tauri/Cargo.toml`
- `focus-tracker/src-tauri/src/browser_semantics.rs`
- `focus-tracker/src-tauri/src/lib.rs`
- `focus-tracker/src-tauri/src/sessionizer.rs`
- `focus-tracker/src-tauri/src/tracker.rs`
- `focus-tracker/src-tauri/src/uploader.rs`
- `focus-tracker/src-tauri/src/outbox.rs`
- `focus-tracker/src-tauri/src/state.rs`
- `src/server/db/schema.ts`
- `src/server/focus/aggregates.ts`
- `src/server/focus/aggregates.test.mjs`
- `src/app/api/focus/ingest/route.ts`
- `src/app/api/focus/status/route.ts`
- `src/components/focus/focus-shared.tsx`
- `src/components/focus/focus-page-client.tsx`
- `drizzle/0009_nostalgic_the_stranger.sql`
- `README.md`
- `docs/changelog/focus-tracker-browser-semantics-phase-1.md`

### Verification Commands And Results

- `cargo test` in `focus-tracker/src-tauri`
  - PASS, `34 passed, 0 failed`
- `node --test --experimental-strip-types src/server/focus/aggregates.test.mjs src/server/focus/tags.test.mjs src/components/focus/focus-display.test.mjs`
  - PASS, `36 passed, 0 failed`
- `pnpm db:generate`
  - PASS, generated `drizzle/0009_nostalgic_the_stranger.sql`
- `pnpm db:push`
  - PASS, local schema changes applied
- `pnpm exec eslint src/components/focus/focus-page-client.tsx src/components/focus/focus-shared.tsx src/components/focus/focus-display.ts src/app/api/focus/ingest/route.ts src/app/api/focus/status/route.ts src/server/focus/aggregates.ts src/server/db/schema.ts`
  - PASS
- `pnpm exec tsc --noEmit`
  - PASS
- `pnpm build`
  - BLOCKED by environment network access to Google Fonts
  - exact failure: `Failed to fetch Geist` and `Failed to fetch Geist Mono`

### Remaining Risks / Follow-up

- This is phase 1 semantics only; it does not yet include server-side activity block naming or rule-priority management.
- Surface-type inference is currently deterministic and host/path-based. It will need broader known-site coverage over time.
- Full repository build verification is still blocked in this environment by external font fetch failures, not by a confirmed application type error.
