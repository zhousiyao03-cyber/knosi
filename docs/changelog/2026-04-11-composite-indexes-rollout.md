# 2026-04-11 — composite indexes production rollout (B1-5)

## Context

Learning phase B1 step 5. Four composite "(user_id, sort_col)" style
indexes to eliminate the "USE TEMP B-TREE FOR ORDER BY" file-sort step
on the hottest list queries. Based on the B1-4 EXPLAIN QUERY PLAN audit
(`scripts/learn/b1-explain-audit.mjs`) which found 10 queries with
in-memory re-sorts against a single-column `(user_id)` index.

## Indexes added

| Index | Table | Covers |
|---|---|---|
| `notes_user_updated_idx` | `notes` | `notes.list` default `ORDER BY updated_at DESC` + 6 other routers using the same ordering |
| `bookmarks_user_created_idx` | `bookmarks` | `bookmarks.list` `ORDER BY created_at DESC` |
| `todos_user_created_idx` | `todos` | `todos.list` + `dashboard.pendingTodos` `ORDER BY created_at DESC` |
| `knowledge_index_jobs_status_queued_idx` | `knowledge_index_jobs` | `claimNextJob` hot path `WHERE status='pending' AND queued_at <= ? ORDER BY queued_at ASC` |

All four follow the "equality-first, range/sort-last" rule:
- `notes / bookmarks / todos`: `user_id` is `=`, `updated_at` / `created_at` is ORDER BY
- `knowledge_index_jobs`: `status` is `=`, `queued_at` is range + ORDER BY

## Drizzle migration

`drizzle/0027_demonic_leo.sql` — 4 `CREATE INDEX` statements, generated
by `pnpm db:generate` from the schema change in `src/server/db/schema.ts`.

## Rollout command

```bash
node scripts/db/apply-2026-04-11-composite-indexes-rollout.mjs
```

All four statements use `CREATE INDEX IF NOT EXISTS` so the script is
idempotent and safe to re-run.

## Rollout output (live run against production Turso)

```
Production Turso rollout — B1-5: composite indexes
Target: libsql://database-bisque-ladder-vercel-icfg-...turso.io

Step 1: inspect existing indexes (before)
  notes_user_updated_idx                        missing
  bookmarks_user_created_idx                    missing
  todos_user_created_idx                        missing
  knowledge_index_jobs_status_queued_idx        missing

Step 2: apply CREATE INDEX IF NOT EXISTS
  OK — notes_user_updated_idx
  OK — bookmarks_user_created_idx
  OK — todos_user_created_idx
  OK — knowledge_index_jobs_status_queued_idx

Step 3: verify (after)
  notes_user_updated_idx      CREATE INDEX ... ON notes (user_id, updated_at)
  bookmarks_user_created_idx  CREATE INDEX ... ON bookmarks (user_id, created_at)
  todos_user_created_idx      CREATE INDEX ... ON todos (user_id, created_at)
  knowledge_index_jobs_status_queued_idx
                              CREATE INDEX ... ON knowledge_index_jobs (status, queued_at)

Step 4: verify query plans use the new indexes
  notes.list:         plan uses notes_user_updated_idx, no TEMP B-TREE
  bookmarks.list:     plan uses bookmarks_user_created_idx, no TEMP B-TREE
  todos.list:         plan uses todos_user_created_idx, no TEMP B-TREE
  claimNextJob pending: plan uses knowledge_index_jobs_status_queued_idx
                        (status=? AND queued_at<?), no TEMP B-TREE

✅ Production rollout verified: 4 composite indexes present and used
```

Step 4 runs `EXPLAIN QUERY PLAN` against the production database
directly — the script doesn't just assume the planner will pick the
new index, it confirms it does.

## Local verification

Applied the same `CREATE INDEX IF NOT EXISTS` statements to
`data/second-brain.db` via `@libsql/client`, then re-ran
`scripts/learn/b1-explain-audit.mjs`:

```
Before B1-5:   8 green / 10 warn
After  B1-5:  14 green /  4 warn
```

The 4 remaining warns are all intentionally skipped:
- `todos due today` — partial file-sort, low absolute cost
- `folders.list` — data volume <20 rows, no perceived benefit
- `learning_notes group by topic` — data volume <100 rows
- `token_usage_entries` — the `tokenUsageEntries` table is declared in
  schema.ts but has no code reading or writing it (no router, no
  instrumentation). The B1-4 audit's entry for it was a false target
  based on a guessed SELECT, not a real hot path.

## Not touched by B1-5 (intentional)

- `notes.list + folder filter` — still uses `notes_folder_id_idx` +
  file-sort. Less frequent than the default list. Left for later.
- `todos_user_duedate_status_idx` — existing triple index is fine for
  `todos due today`, only the secondary ORDER BY key (`updated_at`)
  file-sorts and that's marginal.
- All 4 small-volume tables listed above.

## Risks / follow-ups

- **Write overhead**: each new index adds a small write-path cost on
  INSERT/UPDATE against the covered table. For notes/bookmarks/todos
  that's +1 index per write; acceptable since these tables are
  read-heavy. For `knowledge_index_jobs` it's +1 index per job write,
  still cheap because jobs are small rows.
- **Index bloat**: 4 new indexes increase total DB size by roughly
  (rows × 40 bytes) per index. For a 60-note user that's a few KB.
- **Schema drift**: production and local schemas now agree on these 4
  indexes. Run the audit script again after adding future indexes to
  confirm no regressions.

## Unreferenced table finding

`tokenUsageEntries` is declared in `src/server/db/schema.ts` but not
imported anywhere in `src/**/*.ts` (verified via grep). Either it's a
feature that got cut, or it's waiting for a feature that never shipped.
Flagging for a future cleanup pass — not removed here to keep B1-5
scope tight.
