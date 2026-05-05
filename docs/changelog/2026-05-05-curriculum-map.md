# 2026-05-05 — Curriculum Map (`/learn/map`)

## Goal

Give the user a knowledge gap analysis tool, organized by target role
(AI Engineer, Backend Architect). The user has 100+ scattered notes across
10 flat learning topics, but cannot see at a glance which areas are well
covered vs blank. Force-directed knowledge graphs fail at this — they only
show what exists, not what's missing. A curriculum map (predefined target
topic list × current coverage) is the right primitive.

Spec: `docs/superpowers/specs/2026-05-05-curriculum-map-design.md`.

## Key changes

### Data model
- Four new tables: `curriculum_tracks` / `curriculum_areas` / `curriculum_topics` / `curriculum_topic_notes`
- 4-state mastery on each topic: `blank` / `heard` / `learning` / `mastered`
- `parent_id` self-reference reserved for future subarea expansion (unused in v1)
- Many-to-many topic↔note via composite-PK link table

### Seed + auto-link
- Two default tracks seeded on first `/learn/map` visit (lazy seed):
  - **AI Engineer** (~101 topics across 9 areas)
  - **Backend Architect** (~137 topics across 12 areas)
- Auto-link of existing `learning_notes` by string match (substring +
  Jaccard ≥ 0.55 on bigram tokens; explicit Chinese keyword aliases per topic)
- Auto-bumps mastery from `blank` → `learning` for any topic that received a
  link during seed (one-time bootstrap; not a continuous rule)
- "Re-link notes" button re-runs the matcher against new/renamed notes
- "Reset" button wipes user's curriculum and re-seeds

### UI
- `/learn/map` page: track tabs, per-area sections, color-coded topic grid
- Side panel: mastery toggle, linked notes list, "Link existing" + "Create new"
- Sidebar entry: `Map` under `LEARN` group (Map icon)
- Learn-note editor top bar: `CurriculumTopicsBar` shows linked topics with
  inline picker to add/remove

### tRPC `curriculumRouter`
- `getCurriculum` (lazy seed)
- `getTopicDetail`, `setMastery`, `linkNote`, `unlinkNote`
- `createNoteForTopic` (creates a learning_note + auto-links + returns
  IDs for client navigation)
- `getTopicsForNote`, `searchTopics`, `searchUserNotes`
- `rerunAutoLink`, `resetToDefault`

## Files touched

- `src/server/db/schema/curriculum.ts` (new)
- `src/server/db/schema/index.ts` (re-export)
- `src/server/curriculum/seed-data.ts` (new — full seed content)
- `src/server/curriculum/seed-service.ts` (new — seed + auto-link logic)
- `src/server/routers/curriculum.ts` (new)
- `src/server/routers/_app.ts` (register router)
- `src/app/(app)/learn/map/page.tsx` (new)
- `src/components/learn/curriculum-topics-bar.tsx` (new)
- `src/components/learn/learn-note-client.tsx` (insert CurriculumTopicsBar)
- `src/components/layout/navigation.ts` (sidebar entry)
- `e2e/curriculum-map.spec.ts` (new — 4 tests, all pass)
- `drizzle/0050_tidy_killraven.sql` (generated migration)
- `scripts/db/apply-2026-05-05-curriculum-rollout.mjs` (idempotent prod rollout)

## Database changes

### Local (drizzle-kit push)
```
pnpm db:generate  →  drizzle/0050_tidy_killraven.sql
pnpm db:push      →  applied
```

### Production Turso
```
node scripts/db/apply-2026-05-05-curriculum-rollout.mjs
```
Output verified all 4 tables + 5 indexes exist on production. Transcript:
- `OK — table curriculum_tracks exists`
- `OK — table curriculum_areas exists`
- `OK — table curriculum_topics exists`
- `OK — table curriculum_topic_notes exists`
- All 5 indexes verified.

## Verification

| Step | Result |
| --- | --- |
| `pnpm build` | ✅ Compiled successfully in 10.1s |
| `pnpm lint` | ✅ 0 errors (14 warnings, all pre-existing or `<img>` style) |
| `pnpm test:e2e curriculum-map` | ✅ 4/4 passed in 23.5s |
| Production Turso schema rollout | ✅ All 4 tables + 5 indexes verified |

E2E coverage:
1. Sidebar entry → `/learn/map` → both tracks render
2. Track switch shows different topic sets
3. Click topic → side panel with mastery toggle
4. Mastery change persists across reload

## Eval

Skipped — this change does not touch any RAG / agent / chat-prepare /
provider / tool files (per `CLAUDE.md` §3.1).

## Known limits / follow-ups

- Auto-link has false positives (e.g. broad title "Redis 学习" matches many
  Redis topics) and false negatives (when note title and topic title share
  no keyword). User mitigates via side panel unlink + manual link picker.
- Adding new tracks via UI is not implemented (v1 ships 2 tracks only).
  Future role tracks (Founder, SRE, etc.) require code or DB seed.
- Curriculum content is hardcoded in `seed-data.ts`. To refresh
  topic lists across the user base would require a migration+seed-update flow.
- Embedding-based "suggested topics" on note save is a v2 candidate.
- No drag-reorder / inline-edit yet — user can edit via DB or tRPC.
