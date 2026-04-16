# 2026-04-16 - Fix self-hosted ops page timestamp serialization

## Task / Goal
- Restore `https://www.knosi.xyz/settings/ops` after the production self-hosted dashboard started crashing during server rendering.

## Key Changes
- Added `serializeOpsTimestamp()` in `src/server/ops/page-data.ts` so ops queue timestamps are normalized safely from `Date`, numeric epoch seconds, numeric timestamp strings, or ISO strings.
- Updated the ops queue serializer to use the new normalization helper instead of assuming every database value is a `Date`.
- Added regression coverage in `src/server/ops/page-data.test.ts` for date instances, Turso epoch seconds, numeric strings, ISO strings, and invalid values.
- Confirmed the production root cause by querying the live Turso-backed app container and observing that `coalesce(completed_at, started_at, created_at)` was returning numeric epoch seconds rather than `Date` objects.

## Files Touched
- `src/server/ops/page-data.ts`
- `src/server/ops/page-data.test.ts`
- `docs/changelog/2026-04-16-ops-page-timestamp-serialization.md`

## Verification Commands And Results
- `pnpm tsx --test src/server/ops/page-data.test.ts`
  - Passed (`6` tests green)
- `pnpm lint`
  - Passed with the repository's existing `8` warnings and no new errors
- `AUTH_SECRET=test-secret TURSO_DATABASE_URL=file:data/second-brain.db NEXT_DEPLOYMENT_ID=ops-timestamp-fix pnpm build`
  - Passed
- `ssh knosi 'cd /srv/knosi && docker compose -f docker-compose.prod.yml logs --since=30m --tail=200 knosi'`
  - Used during debugging to confirm the ops page crash was server-side
- `ssh knosi 'cd /srv/knosi && docker compose -f docker-compose.prod.yml exec -T knosi node - <<\'NODE\'' ...`
  - Confirmed production `activity_at` values were numeric epoch seconds (for example `1776327020`)
- `ssh knosi 'APP_DIR=/srv/knosi NEXT_DEPLOYMENT_ID=ops-timestamp-fix /srv/knosi/ops/hetzner/deploy.sh'`
  - Passed and redeployed the fixed build to Hetzner
- `ssh knosi 'cd /srv/knosi && docker compose -f docker-compose.prod.yml logs --since=5m --tail=120 knosi'`
  - No new ops page serialization crash after deploy

## Remaining Risks / Follow-up
- This fix covers the currently observed timestamp shapes from Turso/libsql, but any future query added to the ops page should continue using `serializeOpsTimestamp()` instead of assuming `Date` objects.
- This task did not require a schema change. Production Turso schema rollout was not needed.
