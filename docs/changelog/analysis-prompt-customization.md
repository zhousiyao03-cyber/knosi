# Analysis prompt customization + commit snapshots

**Date:** 2026-04-06

## Goal
Two related improvements to the source-code analysis flow:

1. The analysis prompt was hardcoded inside the local daemon (`tools/usage-reporter/report.mjs`). Editing it required pulling the repo and restarting the daemon, and you could not see or change it from the web UI.
2. Open source projects keep evolving, so an old analysis note quickly drifts from the current code. There was no record of *which commit* a given analysis was based on, or *when* the run finished.

## Changes

### Prompt customization (DB-backed, hot-reload)
- New table `analysis_prompts (userId, kind, content)` with a unique index on `(userId, kind)`. Falls back to bundled defaults when no row exists.
- New default prompts in `src/server/ai/default-analysis-prompts.ts`. Synthesized from cmer's "Ultimate Codebase Analysis" gist, DeepWiki's output structure, and the awesome-claude-prompts XML conventions:
  - XML-tagged sections (`<role>`, `<reading_strategy>`, `<rules>`, `<output_format>`).
  - Four-layer reading discipline (portrait → architecture → core deep dive → tests/CI).
  - Hard rule that every concrete claim must cite `path/to/file.ext:LINE`.
  - "Things You Must Know Before Changing Code" section borrowed from cmer.
  - Mermaid diagrams for both module relationships and core data flow.
  - Snapshot header (commit hash + analysed-at) baked into the H1 of every note, with hyperlinks back to the GitHub repo and the exact commit.
- New tRPC procedures on `ossProjects`: `getAnalysisPrompts`, `upsertAnalysisPrompt`, `resetAnalysisPrompt`.
- New Settings section `AnalysisPromptsSection` (`src/app/(app)/settings/analysis-prompts-section.tsx`) — two large textareas with Save / Reset to default, "Customized" badge, and unsaved-changes indicator.
- The claim API (`/api/analysis/claim`) now resolves the user's prompt template, fills in `REPO_URL` and `ANALYSED_AT`, and ships the half-rendered prompt to the daemon as `task.promptTemplate`. This means **prompt edits in Settings take effect on the very next claim with no daemon restart**.
- The daemon substitutes the remaining commit placeholders (`{{COMMIT_SHA}}`, `{{COMMIT_SHORT}}`, `{{COMMIT_DATE}}`) after `git clone`.

### Commit snapshots
- New columns on `os_projects`: `analysisCommit`, `analysisCommitDate`, `analysisStartedAt`, `analysisFinishedAt`.
- Daemon `cloneRepo` now updates an existing checkout (`fetch --depth=1` + `reset --hard FETCH_HEAD`) instead of silently reusing a stale clone, then captures `git rev-parse HEAD` and `git log -1 --format=%cI`.
- Daemon reports `commitSha` + `commitDate` to `/api/analysis/complete`, which writes them onto the project row along with `analysisFinishedAt`.
- Project detail page now shows the snapshot row under the description: `commit abc1234 · committed YYYY-MM-DD · run YYYY-MM-DD`. The commit short-hash is a hyperlink to `repoUrl/commit/<sha>`.
- Discover tab tooltips now include the commit + analysed-date on the "Analysed" badge and "Open analysis" link.
- New "Re-analyse" button on the project detail page (only visible after a completed analysis) — picks up the latest commit and produces a fresh note while preserving the old one.

### Concurrency bump (carried over from previous session)
- `MAX_CONCURRENT_ANALYSIS` already bumped from 3 → 5 in commit `8a4d1b7`.

## Files touched
- `src/server/db/schema.ts` — new table + 4 columns
- `src/server/ai/default-analysis-prompts.ts` (new) — defaults + `renderPrompt`
- `src/server/routers/oss-projects.ts` — three new procedures
- `src/app/api/analysis/claim/route.ts` — server-side prompt rendering
- `src/app/api/analysis/complete/route.ts` — accept commit fields, stamp project
- `src/app/(app)/settings/page.tsx` — embed new section
- `src/app/(app)/settings/analysis-prompts-section.tsx` (new) — editor UI
- `src/app/(app)/projects/[id]/page.tsx` — snapshot row + Re-analyse button
- `src/app/(app)/projects/discover-tab.tsx` — Analysed badge tooltip with commit + date
- `tools/usage-reporter/report.mjs` — `cloneRepo` rewrite, prompt template path, commit reporting
- `drizzle/0018_keen_avengers.sql` — generated migration

## Verification
- `pnpm db:generate` → produced `0018_keen_avengers.sql` (1 new table + 4 ALTERs)
- `pnpm db:push` → applied to local Turso, no errors
- `pnpm build` → compile + typecheck pass
- `pnpm lint` → no new errors on the files I touched (the 6 pre-existing errors in `editor/toc-*` are unrelated)
- `node --check tools/usage-reporter/report.mjs` → daemon syntax OK

## Production rollout / follow-ups
- **Production schema:** `pnpm db:push` only updated the local SQLite. Production Turso still needs the new table + columns. Run `pnpm db:push` against the production env (or apply `drizzle/0018_keen_avengers.sql` directly) before deploying.
- **Daemon restart required for one thing:** the new commit-capture and prompt-template substitution live in `report.mjs`. The local daemon needs to be restarted (`pnpm usage:daemon`) to pick those up. After that single restart, future prompt edits made in Settings will hot-reload with no further restarts.
- **Existing analysed projects** will not retroactively show a commit snapshot — those rows have `analysisCommit = null`. Triggering a Re-analyse on each will populate the new fields.
- **Did not run `pnpm test:e2e`** — these changes touch a flow that depends on the local daemon and external git/clone, which is hard to cover in e2e. Self-verification was via build, lint, syntax check, and manual code review of every changed file. If you want, I can add a unit test for `renderPrompt` placeholder substitution next.
