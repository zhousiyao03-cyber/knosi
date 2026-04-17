# 2026-04-16 - Align ops system memory metrics with Linux host semantics

## Task / Goal
- Make the `/settings/ops` System card report host memory in a way that matches what the Hetzner box is actually doing, instead of making Linux page cache look like exhausted RAM.

## Key Changes
- Updated `ops/hetzner/collect-ops-snapshot.sh` to capture `free`, `available`, `buff/cache`, `shared`, and `swap` memory fields from `/proc/meminfo`.
- Changed the memory calculation so `usedBytes` now matches the host's `free -h` `used` column (`total - available`), while still exposing `Available`, `Cache`, and `Swap` separately for context.
- Extended the host snapshot schema and tests to require the new memory and swap fields.
- Updated the Ops dashboard System card to show:
  - `Memory (used)`
  - `Available`
  - `Cache`
  - `Swap`
  - plus the existing `Disk`, `Load`, and `Uptime`
- Documented the new semantics in `README.md` so the dashboard numbers can be compared directly against `free -h`.

## Files Touched
- `ops/hetzner/collect-ops-snapshot.sh`
- `src/server/ops/host-snapshot.ts`
- `src/server/ops/host-snapshot.test.ts`
- `src/app/(app)/settings/ops/ops-dashboard.tsx`
- `README.md`
- `docs/changelog/2026-04-16-ops-memory-metrics-alignment.md`

## Verification Commands And Results
- `pnpm tsx --test src/server/ops/host-snapshot.test.ts`
  - Passed (`2` tests green)
- `pnpm lint`
  - Passed with the repository's existing `8` warnings and no new errors
- `AUTH_SECRET=test-secret TURSO_DATABASE_URL=file:data/second-brain.db NEXT_DEPLOYMENT_ID=ops-memory-metrics pnpm build`
  - Passed
- `ssh knosi 'APP_DIR=/srv/knosi /srv/knosi/ops/hetzner/collect-ops-snapshot.sh && cat /srv/knosi/runtime/ops-snapshot.json'`
  - Passed and produced the expanded memory snapshot
- `ssh knosi 'free -h && echo && swapon --show'`
  - Used to verify the dashboard snapshot matches the box's real memory, cache, and swap behavior
- `ssh knosi 'APP_DIR=/srv/knosi NEXT_DEPLOYMENT_ID=ops-memory-metrics /srv/knosi/ops/hetzner/deploy.sh'`
  - Passed and deployed the dashboard update to Hetzner

## Remaining Risks / Follow-up
- The Ops page is still a point-in-time snapshot collected by cron, so the values can lag behind real-time host pressure by up to one snapshot interval.
- This task did not require a schema change. Production Turso schema rollout was not needed.
