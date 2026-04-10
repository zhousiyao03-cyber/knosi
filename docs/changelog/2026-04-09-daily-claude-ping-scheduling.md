# Daily Claude Ping Scheduling — 2026-04-09

## date
- 2026-04-09

## task / goal
- Make the local usage daemon fire the Claude warm-up ping at the next exact local `05:59` slot only, instead of checking hourly and backfilling later in the day.

## key changes
- Added `tools/usage-reporter/daily-ping-scheduler.mjs` with pure helpers for calculating the next local `05:59` run time and delay.
- Added `tools/usage-reporter/daily-ping-scheduler.test.mjs` to lock the intended behavior:
  - `05:58` schedules for the same day `05:59`
  - `23:33` schedules for the next day `05:59`
  - exact `05:59` stays aligned to that slot
- Updated `tools/usage-reporter/report.mjs`:
  - removed the hourly `setInterval` polling approach
  - removed the in-memory `lastDailyPingDate` backfill behavior
  - replaced it with chained `setTimeout` scheduling to the next exact local `05:59`
  - added startup logging for the next scheduled local ping time

## files touched
- `tools/usage-reporter/daily-ping-scheduler.mjs`
- `tools/usage-reporter/daily-ping-scheduler.test.mjs`
- `tools/usage-reporter/report.mjs`

## verification commands and results
- `node --test tools/usage-reporter/daily-ping-scheduler.test.mjs`
  - Passed: 3 tests, 0 failures
- `pnpm lint`
  - Passed with 0 errors
  - Existing repo warnings remain in unrelated files:
    - `e2e/editor.spec.ts`
    - `src/components/editor/excalidraw-block.tsx`
    - `src/components/editor/image-row-block.tsx`
    - `src/components/editor/slash-command.tsx`
- `node --test src/lib/note-templates.test.mjs tools/focus-collector/sessionizer.test.mjs`
  - Partial result: `sessionizer.test.mjs` passed
  - `note-templates.test.mjs` failed before execution of assertions because Node could not load `src/lib/note-templates.ts` directly (`ERR_UNKNOWN_FILE_EXTENSION ".ts"`). This appears to be a pre-existing test-runner setup issue, not caused by this task.

## remaining risks or follow-up items
- The new scheduling is process-memory based. If the daemon is not running at `05:59`, that day’s ping is intentionally skipped rather than backfilled later.
- The daemon now logs the next scheduled local fire time, which should make future timing checks easier.
- If we want missed runs to survive process restarts, we would need a persisted scheduler state or an external scheduler; that is intentionally not part of this change.
