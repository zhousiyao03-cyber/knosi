# Portfolio Task 3 — Real-Time Price Fetching

**Date:** 2026-04-01
**Task:** Implement `getPrices` procedure with Yahoo Finance (stocks) and CoinGecko (crypto)

## Key Changes
- Replaced placeholder `getPrices` in `portfolio.ts` with real implementation
- Yahoo Finance v8 chart API for stock prices (parallel fetches with `Promise.all`)
- CoinGecko simple/price API for crypto (single batched request)
- Null fallback on all error paths — never throws to client

## Files Touched
- `src/server/routers/portfolio.ts`

## Verification
- `pnpm build`: ✅ passed

## Residual Risks
- Yahoo Finance API has no official SLA — may throttle or change response format
- CoinGecko free tier has rate limits (50 req/min) — may hit limit with many concurrent users
- 15 common crypto symbols mapped; unknown symbols return null price
