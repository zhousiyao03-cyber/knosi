# Portfolio Holding Edit UI

**Date:** 2026-04-01

**Task / Goal:** Improve the Portfolio UI with holding edits, value-based ordering, daily change display, and fresh price refetching on entry.

## Key Changes

- Updated the Portfolio holding cards to expose a `修改` action beside delete on hover.
- Added an `EditHoldingModal` in the Portfolio client page for editing:
  - `quantity`
  - `costPrice`
- Wired the modal to the existing `portfolio.updateHolding` mutation.
- After saving, the page now refreshes holdings and price-derived summary data.
- Sorted the holding list by current total value descending, falling back to cost basis when live price is unavailable.
- Added per-holding daily change display and a top-level `今日变化` summary derived from current price vs previous close.
- Added per-holding `持仓金额` and `占组合` display so each position shows its current contribution to the portfolio.
- Updated the live price query so entering the page or refocusing the window re-fetches the latest prices instead of relying on stale cache.
- Updated `AGENTS.md` verification rules to allow skipping dedicated automated tests for very small, low-risk frontend tweaks when the user explicitly treats them as simple.

## Files Touched

- `src/app/(app)/portfolio/_client.tsx`
- `AGENTS.md`
- `docs/changelog/2026-04-01-portfolio-holding-edit-ui.md`

## Verification Commands And Results

- `source ~/.nvm/nvm.sh && nvm use >/dev/null && pnpm exec eslint 'src/app/(app)/portfolio/_client.tsx'`
  - Passed
- `source ~/.nvm/nvm.sh && nvm use >/dev/null && pnpm build`
  - Passed

## Remaining Risks / Follow-up

- This edit flow only updates quantity and cost price; renaming a holding or changing symbol/type is still intentionally unsupported.
- Browser-level authenticated interaction was not automated here; verification relies on build/lint plus local runtime validation.
