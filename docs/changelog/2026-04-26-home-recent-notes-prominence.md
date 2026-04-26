# 2026-04-26 Home Page — Recent Notes Prominence

## Task / Goal

User feedback: Recent Notes is the most-used block on the home page,
but it lived at the bottom under three less-used analytics modules.
Lift it to the top, make it visually denser, and demote the analytics.

## Key Changes

- `Recent Notes` moves from the last position to the second (right
  under the header). Heading upgraded from a tiny uppercase label to a
  real semibold title.
- List grows from 5 to 15 items. Each row now renders the note's
  `folder` as a small grey tag when present, so 八股文 / journal / 学
  notes are distinguishable at a glance.
- `AI → Knowledge` collapses from a three-column card into a single
  one-line metric strip below Recent Notes (same numbers, links to
  `/notes`).
- `Today's Focus` and the 30-day heatmap stay as-is, just relocated
  below.
- `dashboard.stats` tRPC trims `recentLearnNotes` and
  `recentProjectNotes` from its response — both fields were unused by
  the dashboard client. `recentNotes` query now selects `folder` and
  uses `limit(15)`.

## Files Touched

- `src/app/(app)/dashboard/page.tsx` (initial-stats seed)
- `src/components/dashboard/dashboard-page-client.tsx` (layout, folder
  tag, compact AI strip)
- `src/server/routers/dashboard.ts` (query shape + limit, drop unused)
- `e2e/dashboard-recent-notes.spec.ts` (new — verifies DOM ordering and
  fresh-note-at-top)
- `docs/superpowers/specs/2026-04-26-home-recent-notes-prominence-design.md`
  (design)
- `docs/changelog/2026-04-26-home-recent-notes-prominence.md` (this file)

## Verification Commands And Results

- `pnpm build` → passed
- `pnpm lint` (run directly via `npx eslint`, ignoring `.next-e2e*/`
  build outputs which only exist locally) → 0 errors on changed files,
  0 errors when CI's view is matched.
- `pnpm test:e2e dashboard-recent-notes` → **blocked locally on
  Windows.** Pre-existing infrastructure issue: Playwright starts
  `webServer` (which runs `pnpm db:push && next dev`) before
  `globalSetup` runs. On Windows, the `next dev` process keeps a
  SQLite handle open on `data/second-brain.e2e.db`, so
  `globalSetup`'s `rmSync` of that file fails with EBUSY. Linux
  unlink-while-open semantics make this work on CI / macOS. Not caused
  by this change. The new spec was written and should pass on Linux.

## Remaining Risks / Follow-up

- Dropping `recentLearnNotes` / `recentProjectNotes` from
  `dashboard.stats` is the only response-shape change. Verified no
  consumers in `src/` or `e2e/` before removing.
- Schema is unchanged (no migration needed; no production Turso
  rollout required).
- Production verification: this commit pushes to `main` which triggers
  the Hetzner deploy. User should refresh `https://www.knosi.xyz/`
  after the deploy finishes and confirm Recent Notes is now the second
  block, with 15 items and folder tags where applicable.
- The Windows e2e blocker is worth a separate fix (e.g. switch
  `globalSetup` to truncate tables instead of unlink, or wait for a
  patch upstream in Playwright). Out of scope for this UI change.
