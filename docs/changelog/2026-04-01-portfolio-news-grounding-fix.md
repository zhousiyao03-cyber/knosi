# Portfolio News Grounding Fix

**Date:** 2026-04-01

**Task / Goal:** Fix Portfolio news items returning near-identical generic summaries with no real recent article grounding.

## Key Changes

- Added `src/server/portfolio-news.ts`:
  - build search queries from `symbol + holding name + asset type` to reduce ticker ambiguity
  - fetch recent article candidates from Google News RSS
  - parse RSS items into normalized article records
- Updated `src/server/routers/portfolio.ts`:
  - `generatePortfolioNews()` now looks up the holding name/type before generating news
  - news summaries are now generated from fetched article evidence instead of asking the model to "search"
  - added a grounded fallback summary when no article is found or AI structured output fails
  - removed the manual refresh debounce so the Portfolio page refresh button actually re-fetches news immediately
- Added `src/server/portfolio-news.test.mjs` to lock the query-building and RSS parsing behavior.

## Files Touched

- `src/server/portfolio-news.ts`
- `src/server/portfolio-news.test.mjs`
- `src/server/routers/portfolio.ts`

## Verification Commands And Results

- `source ~/.nvm/nvm.sh && nvm use >/dev/null && node --experimental-strip-types --test src/server/portfolio-news.test.mjs`
  - Passed (`3/3` tests)
- `source ~/.nvm/nvm.sh && nvm use >/dev/null && pnpm exec eslint src/server/portfolio-news.ts src/server/routers/portfolio.ts src/server/portfolio-news.test.mjs`
  - Passed
- `source ~/.nvm/nvm.sh && nvm use >/dev/null && pnpm build`
  - Passed
- `source ~/.nvm/nvm.sh && nvm use >/dev/null && node --experimental-strip-types --input-type=module -e "import { fetchRecentPortfolioNewsArticles } from './src/server/portfolio-news.ts'; const articles = await fetchRecentPortfolioNewsArticles({ symbol: 'JD', name: '京东', assetType: 'stock' }); console.log(articles.map(({ title, source, publishedAt }) => ({ title, source, publishedAt })).slice(0, 5));"`
  - Returned real article rows for `JD/京东`, confirming the fetch layer is no longer template-only
- `source ~/.nvm/nvm.sh && nvm use >/dev/null && node --experimental-strip-types --input-type=module -e "import { fetchRecentPortfolioNewsArticles } from './src/server/portfolio-news.ts'; const articles = await fetchRecentPortfolioNewsArticles({ symbol: 'BMNR', name: 'BMNR', assetType: 'stock' }); console.log(JSON.stringify(articles.slice(0, 3), null, 2));"`
  - Returned a non-empty article list for `BMNR`, confirming the RSS lookup path works for that holding too

## Remaining Risks / Follow-up

- Google News RSS quality depends on the ticker/name disambiguation; very ambiguous symbols can still surface partial or stale matches.
- If there are no recent articles in the RSS feed, the system falls back to older matching articles rather than pretending fresh news exists.
- The UI still renders only the summarized text; if stronger transparency is needed later, add surfaced article sources/links to the Portfolio panel.
