# 2026-04-09 — Mobile share-page table overflow

## Date

- 2026-04-09

## Task / Goal

- Fix the mobile share-page layout bug where a wide note table expands the full page width instead of staying inside a local horizontal scroller.

## Key Changes

- Enabled Tiptap table wrapper rendering even when the editor is read-only, so shared note pages now render tables inside `.tableWrapper` instead of as bare `<table>` elements.
- Hardened the global shared-editor table wrapper styles for mobile:
  - `width: 100%`
  - `max-width: 100%`
  - horizontal scrolling contained to the wrapper
  - touch-friendly inertial scrolling on iOS
- Added a Playwright regression that:
  - creates a project note
  - inserts a deliberately wide table
  - opens the public share link in an iPhone viewport
  - verifies the table is wrapped in `.tableWrapper`
  - verifies the page itself no longer overflows horizontally

## Files Touched

- `src/components/editor/editor-extensions.ts`
- `src/app/globals.css`
- `e2e/share-links.spec.ts`
- `docs/changelog/2026-04-09-mobile-share-table-overflow.md`

## Verification Commands And Results

- `pnpm exec playwright test e2e/share-links.spec.ts --config=playwright.auth.config.ts --grep "project note share pages keep wide tables inside a mobile scroller" --reporter=line`
  - Passed: `1 passed (11.9s)`
- `pnpm exec playwright test e2e/share-links.spec.ts --config=playwright.auth.config.ts --workers=1 --reporter=line`
  - Passed: `3 passed (27.1s)`
- `pnpm exec eslint 'src/components/editor/editor-extensions.ts' 'e2e/share-links.spec.ts'`
  - Passed
- `pnpm build`
  - Passed

## Remaining Risks Or Follow-up Items

- The new regression covers the project-note share page directly. The underlying editor change also affects regular shared notes, and the existing share-link coverage still passes after the fix.
- The auth Playwright setup reuses a prepared SQLite test database, so running multiple auth-config Playwright invocations at the same time can cause temporary DB locking during test setup.
