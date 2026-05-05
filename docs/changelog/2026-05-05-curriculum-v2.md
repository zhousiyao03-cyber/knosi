# 2026-05-05 — Curriculum v2 (B1–B5)

Five feature batches landed today on top of the v1 spec. Each batch went
through build/lint/e2e + production Turso rollout + git push.

## What changed

### B1 — Auto-link + tag deep-link + mobile panel
- `learning_notebook.createNote/updateNote` calls `autoLinkNote(userId, noteId, title)`
  on save (best-effort, never fails the write). Update only re-links when the
  title actually changed.
- `CurriculumTopicsBar` tags now point at `/learn/map?topicId=...`. The page
  reads the param, switches to the owning track, opens the side panel, scrolls
  the card into view. Applied once per arrival (idempotent).
- Side panel is full-width on small screens with a tap-to-close backdrop;
  track tabs scroll horizontally; sm:380px on desktop.

### B2 — General notes integration + bulk unlink + source badges
- New table `curriculum_topic_general_notes` (composite PK, FK to `notes`).
  `source` column added to both link tables (`auto_substring` / `auto_jaccard` /
  `manual`).
- `seed-service` matcher returns the source on a hit. Auto-link runs for both
  kinds on initial seed and on per-note save.
- `notes.create` / `notes.update` hook `autoLinkNote(..., "general")`.
- `NoteEditorPageClient` (general notes) gains `<CurriculumTopicsBar kind="general">`.
- Polymorphic router: `linkNote` / `unlinkNote` / `getTopicsForNote` take
  `kind: "learning" | "general"` (default learning). `getTopicDetail` merges
  both kinds, sorts by source rank (manual → substring → jaccard).
- New `bulkUnlink` mutation. Side panel has a "Select" mode with checkboxes
  and a single mass-unlink action.
- Linked-note rows show a `Manual` / `Auto` / `Fuzzy` badge tied to source.

### B3 — Editable curriculum + AI descriptions
- 9 new tRPC mutations: createTrack/updateTrack/deleteTrack +
  createArea/updateArea/deleteArea + createTopic/updateTopic/deleteTopic.
- `generateDescription` mutation: calls `generateStructuredData` with track + area
  + topic context, persists to `curriculum_topics.description`.
- New component file `curriculum-editors.tsx`:
  - `NewTrackButton` (modal: icon + title)
  - `NewAreaButton` (inline form at end of track)
  - `AreaActions` (rename + delete with confirm)
  - `NewTopicInline` (extra grid card → inline form)
  - `TopicEditActions` (Rename / Delete in side panel header)
  - `GenerateDescriptionButton` (in side panel description block)

### B4 — Inline-editable description (embedding suggestions deferred)
- `EditableDescription` (added to curriculum-editors.tsx): click text to edit
  via textarea + Save. Reuses `setTopicDescription` mutation.
- Side panel description always shows the editor (with empty-state copy when
  there is no description yet).
- Originally B4 was going to add embedding-based "suggested topics" on save,
  but the cost+complexity wasn't justified vs current string-match coverage.

### B5 — Knowledge audit + mastery progress chart
- New tables: `curriculum_mastery_log` (snapshot on every mastery change in
  `setMastery`), `curriculum_audits` (saved LLM gap analyses with
  summary/strengths/weak_areas/missing_must_knows/next_steps as JSON arrays).
- `runAudit` builds a compact inventory of every topic + mastery + linked note
  titles, feeds it to `generateStructuredData` with a "be honest, not generic"
  prompt, persists the result.
- New page `/learn/audit`:
  - Track tabs + Run audit button.
  - Shows past audit cards (newest first) with color-coded sections.
  - Mastery progress chart (90 days) embedded at top.
- Sidebar: new `Audit` entry under LEARN.

## Production rollouts (all idempotent, all verified)

```
node scripts/db/apply-2026-05-05-curriculum-rollout.mjs    # B1
node scripts/db/apply-2026-05-05-curriculum-b2-rollout.mjs # B2
node scripts/db/apply-2026-05-05-curriculum-b5-rollout.mjs # B5
```

Tables on production Turso after all rollouts:

```
curriculum_tracks
curriculum_areas
curriculum_topics
curriculum_topic_notes            (with source column)
curriculum_topic_general_notes    (with source column)
curriculum_mastery_log
curriculum_audits
```

## Verification

| Step | Result |
| --- | --- |
| `pnpm build` | ✅ each batch |
| `pnpm lint` | ✅ 0 errors in our files |
| `pnpm test:e2e curriculum-map` | ✅ 4/4 passed each batch |
| Production Turso schema rollout | ✅ all tables + indexes verified |
| `git push` | ✅ 5 commits across batches, deploys triggered |

## Known follow-ups

- Embedding-based "Suggested topics" — deferred from B4.
- Drag-reorder for tracks/areas/topics — manual reorder still requires
  changing `order_index` via a future UI.
- Audit page e2e coverage.
- React key warnings ("two children with same key T/S") came from the Words
  module during e2e runs, not curriculum — unrelated, pre-existing.
- Curriculum-map e2e didn't grow to cover B2/B3/B4/B5 explicitly; existing
  4 cases still pass and exercise the full create/seed path.
