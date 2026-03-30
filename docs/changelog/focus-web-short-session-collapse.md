## 2026-03-30

### Task / Goal

Reduce noise on the Web `/focus` page by hiding sessions and focus blocks shorter than ten minutes from the default view, while preserving all stored data and metrics.

### Key Changes

- Added a pure display helper to split focus rows into visible and hidden groups using a `10m` threshold.
- Updated the `/focus` page so:
  - focus blocks under ten minutes are collapsed by default
  - raw sessions under ten minutes are collapsed by default
  - each collapsed section shows total hidden time and item count
  - the user can expand short blocks and short sessions on demand
- Added browser-semantics design and implementation docs for the agreed “Rize-style without extension” direction:
  - `docs/superpowers/specs/2026-03-30-focus-tracker-browser-semantics-design.md`
  - `docs/superpowers/plans/2026-03-30-focus-tracker-browser-semantics.md`

### Files Touched

- `src/components/focus/focus-display.ts`
- `src/components/focus/focus-display.test.mjs`
- `src/components/focus/focus-page-client.tsx`
- `README.md`
- `docs/changelog/focus-web-short-session-collapse.md`
- `docs/superpowers/specs/2026-03-30-focus-tracker-browser-semantics-design.md`
- `docs/superpowers/plans/2026-03-30-focus-tracker-browser-semantics.md`

### Verification Commands And Results

- `node --test --experimental-strip-types src/components/focus/focus-display.test.mjs`
  - PASS, `3/3`
- `pnpm build`
  - BLOCKED by environment network access to Google Fonts
  - exact failure: `Failed to fetch Geist from Google Fonts` and `Failed to fetch Geist Mono from Google Fonts`

### Remaining Risks / Follow-up

- The display threshold only changes the Web view. API payloads, metrics, top-app calculations, and stored sessions are unchanged by design.
- A full browser-semantics implementation is still pending; this task only cleaned up the current `/focus` experience and documented the next phase.
