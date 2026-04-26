# notes.list / notes.get latency fix

**Date:** 2026-04-26

## Goal

`/notes` and "open note" had visibly regressed: list took several
seconds, opening a note added another second of white-screen before
the editor mounted. User report: "接口速度又很慢了".

## Root cause

Commit `927472f` ("fix: simplify focus timing and add journal
weekdays") introduced `normalizeJournalTitlesForUser` and called it
**before the cache layer** in both `notes.list` and `notes.get`:

```ts
.query(async ({ input, ctx }) => {
  await normalizeJournalTitlesForUser(ctx.userId);  // every call → Turso RTT
  return notesListCache.getOrLoad(...);             // cache sits BEHIND it
}),
```

The function does a `SELECT id, title FROM notes WHERE type='journal'`
scan on every call. The Hetzner→Turso (us-east-1) round-trip is ~200ms,
so every list/get paid that cost up front. Opening a note triggers
both `list` (sidebar) and `get` (body) → 2 wasted scans before any
real query.

Verification on the affected user: 29/29 journal notes were already
normalized — the function was doing pure no-op work, just paying the
network cost.

## Secondary win

`notes.list` was using `db.select().from(notes)` — selecting every
column including `content` (Tiptap JSON, up to ~96 KB per row). Moved
to an explicit projection that drops `content`, `tags`, `shareToken`,
`sharedAt`, `version`, and the legacy `folder` field. None of the list
consumers (`notes-page-client`, `folder-tree`, dashboard, ask) read
those fields off the list output — confirmed via grep.

## Changes

- `src/server/routers/notes.ts`
  - `list`: removed `normalizeJournalTitlesForUser` call, switched to
    explicit column projection (id, userId, title, plainText, type,
    icon, cover, folderId, createdAt, updatedAt).
  - `get`: removed `normalizeJournalTitlesForUser` call.
  - `openTodayJournal` still calls it, so any leftover unnormalized
    rows still get fixed when the user opens a fresh journal —
    we just don't pay for the scan on every read.

## Verification

| Step | Result |
|---|---|
| `pnpm build` | ✅ Compiled successfully |
| `npx eslint .` (bypassing the Windows `mkdir -p` shim that breaks `pnpm lint`) | ✅ 0 errors, 12 pre-existing warnings |
| `pnpm test:e2e` | ⏸ Blocked by pre-existing toolchain issue: commit `c5afa2a` introduced a second `webServer` entry in `playwright.config.ts` that races for the same `.next/dev/lock` lockfile under Next 16. Both `next dev` instances try to bind the same lock and one always exits with `Another next dev server is already running`. Not caused by this change. |
| Manual HTTP smoke against a single dev server on :3199 | ✅ `notes.list` returns 200 with `{items,hasMore,offset}`, projected columns confirmed via direct DB query (no `content`, has `plainText`). |
| Production journal-row check | ✅ 29/29 already normalized → removed call is a true no-op. |

## Production deploy

Push to `main` → GitHub Actions rsync + redeploy via
`ops/hetzner/deploy.sh` (per `CLAUDE.md`). No schema change, no daemon
CLI bump needed.

## Remaining risks

- The `playwright.config.ts` lockfile collision still blocks
  `pnpm test:e2e` on this machine. Pre-existing, not made worse by
  this change. Worth a follow-up to give the billing webServer its
  own `distDir` (or fold both into a single dev server with two ports
  via Next config).
- If a user has unnormalized journal titles, they will only get
  fixed when they trigger `openTodayJournal`. The hot-path scan was
  always wasted work for normalized titles, so this is fine; if a
  one-off rollout is needed for a specific user we can run
  `normalizeJournalTitlesForUser` from a script.
