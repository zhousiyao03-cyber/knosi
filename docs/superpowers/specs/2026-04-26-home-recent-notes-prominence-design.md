# Home Page — Recent Notes Prominence

**Date:** 2026-04-26
**Scope:** Single-page redesign of the dashboard (home) route.

## Problem

The home page (`/dashboard`) currently shows, in this order:

1. Header (greeting + buttons)
2. AI → Knowledge card (3 large stat numbers)
3. Today's Focus card
4. Last 30 Days Focus heatmap
5. Recent Notes (5 items, label-style heading at the bottom)

User self-reports that Recent Notes is the most-used block on this page; the other blocks are seldom consulted. Today the most-used block is buried below ~3 screenfuls of less-used content, and only shows 5 items.

## Goal

Make Recent Notes the visual centerpiece of the home page without removing the other modules.

## Non-Goals

- No changes to `/notes`, sidebar, or any other route.
- No new dependencies, no new shared components.
- No body-text snippet preview on each row (keeps row height tight so 15 items fit on one screen).
- No scrolling list / virtualization (15 is a static count).
- No changes to `recentLearnNotes` / `recentProjectNotes` consumers — those payloads are already unused on the dashboard client (verified) and will be removed from the response shape to keep the API tight.

## Design

### Layout (after change)

```
┌─────────────────────────────────────────────────────────┐
│ Header: greeting + name + Today's Journal / All Notes   │
├─────────────────────────────────────────────────────────┤
│ Recent Notes                              View all →    │
│ ─────────────────────────────────────────────────────── │
│ Note title                       [folder]      Apr 26   │
│ Note title                                     Apr 26   │
│ Note title                       [八股文]       Apr 25   │
│ ...                                                     │
│ (15 rows total)                                         │
├─────────────────────────────────────────────────────────┤
│ ⚡ AI → Knowledge   0 captured · 0k tokens · 0.0/day    │
├─────────────────────────────────────────────────────────┤
│ Today's Focus card (unchanged)                          │
├─────────────────────────────────────────────────────────┤
│ Last 30 Days Focus heatmap (unchanged)                  │
└─────────────────────────────────────────────────────────┘
```

### Recent Notes module

- **Position:** moves from last to first (directly below header).
- **Heading:** upgrade from `text-[10px] uppercase tracking-[0.14em] text-stone-400` (label-style) to `text-sm font-semibold text-stone-900 dark:text-stone-50`. The "View all →" link on the right keeps its current muted style.
- **Item count:** 15 (was 5).
- **Row anatomy:**

  ```
  ┌─────────────────────────────────────────────────────────┐
  │ {title, truncated}      [{folder}]?            {date}   │
  └─────────────────────────────────────────────────────────┘
  ```

  - Title — `flex-1 min-w-0 truncate text-sm text-stone-800 dark:text-stone-200`
  - Folder tag — only rendered when `note.folder` is non-null/non-empty. Style:
    `rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-900 dark:text-stone-400`. Truncates to one line.
  - Date — `shrink-0 text-[11px] tabular-nums text-stone-400`, formatted via existing `formatDate()`.
- **Empty / loading states:** unchanged copy.

### AI → Knowledge module

- Collapses from a multi-row card with three large stat numbers into a single compact row, keeping all three numbers as inline metrics:

  ```
  ⚡ AI → Knowledge   {captured} captured · {tokens}k tokens · {avg}/day        →
  ```

- Row height target: ~40px including padding.
- Made into a `Link` to `/notes` (or kept non-interactive — see Open Questions). Recommendation: link to `/notes` so the card has a natural target.
- Hides itself if `tokenStats` is absent (same as today).

### Today's Focus and 30-Day Heatmap

- No changes. They remain in their current positions, now appearing third and fourth in the page rather than second and third.

## Data Changes

### `dashboard.stats` tRPC query — `src/server/routers/dashboard.ts`

1. `recentNotes` query:
   - Add `folder: notes.folder` to the select.
   - Change `.limit(5)` to `.limit(15)`.
2. Remove `recentLearnNotes` and `recentProjectNotes` queries from `computeDashboardStats` and from the returned object. (Confirmed unused by `dashboard-page-client.tsx`.)

### `src/app/(app)/dashboard/page.tsx`

- Mirror the same changes used to seed `initialStats`:
  - Add `folder` to the `recentNotes` select; bump limit to 15.
  - Drop the local `recentLearnNotes` / `recentProjectNotes` queries and the corresponding fields on `initialStats`.

### `DashboardPageClient`

- Render the new ordering described above.
- Update the `recentNotes.map(...)` row to render the optional folder tag.
- Replace the AI → Knowledge card markup with the compact one-line variant.
- Promote the Recent Notes heading style.

## Verification

1. **Build / lint / e2e:** `pnpm build`, `pnpm lint`, `pnpm test:e2e` — must all pass.
2. **New e2e case** in `e2e/`: navigate to `/dashboard`, confirm
   - the Recent Notes section appears before the AI → Knowledge section in DOM order, and
   - at least one row exists when the test user has notes (assert ≥ 1, not ≥ 8 — the test fixture isn't guaranteed to have 8+ notes; the limit increase is verified in unit-level review of the server query).
   - The AI → Knowledge block, when present, contains all three metric labels (`captured`, `tokens`, `/day`) on a single card.
3. **Manual smoke (dev server):** load the home page, confirm a folder tag renders for a note that has a folder (e.g. one of the 八股文 notes) and is omitted for a note that does not.

## Open Questions

- **AI → Knowledge clickability:** make the compact row clickable (links to `/notes`) or non-interactive? Default in this design: clickable. If it conflicts with existing UX expectations, leave as a static row — trivial to flip.

## Files Touched

- `src/server/routers/dashboard.ts` — query changes, response shape trim.
- `src/app/(app)/dashboard/page.tsx` — initialStats seed updated.
- `src/components/dashboard/dashboard-page-client.tsx` — layout, AI→Knowledge compaction, Recent Notes heading + folder tag + count.
- `e2e/<phase>.spec.ts` — new test (location TBD by writing-plans skill — likely a new file scoped to this change rather than appending to an existing phase file).

## Risks / Rollback

- Removing `recentLearnNotes` / `recentProjectNotes` from the response is the only API-shape change. Verified unused on the dashboard client. If any other consumer is found during implementation, keep the fields and only adjust limits/folder.
- Pure visual change otherwise. Easy revert via git if it doesn't feel right after a day of use.
