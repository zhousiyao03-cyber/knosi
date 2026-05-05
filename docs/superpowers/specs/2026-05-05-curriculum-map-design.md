# Curriculum Map — Design Spec

**Date**: 2026-05-05
**Author**: zhousiyao03 + Claude
**Status**: Approved, in implementation
**Module**: `/learn/map`

## Why

User has 100+ scattered `learning_notes` and 10 flat `learning_topics`. Cannot see at a glance:
- which knowledge areas are well covered
- which areas are blank
- whether knowledge structure aligns with target roles (AI Engineer, Backend Architect)

Force-directed graph visualizations show what exists but not what's missing — they fail at gap analysis. A curriculum map (predefined target topic list × current coverage) is the right primitive.

## Scope

### In scope (v1)
- Two seed tracks: AI Engineer (~101 topics) and Backend Architect (~137 topics)
- Three-level data model: track → area → topic (with `parent_id` reserved for future subarea)
- 4-state mastery on each topic: `blank` / `heard` / `learning` / `mastered`
- Per-user owned curriculum (each user gets their own copy on first visit)
- Many-to-many link between curriculum_topics and existing learning_notes
- `/learn/map` page: track switcher + grid view + clickable topics
- Side panel: topic detail + state toggle + linked notes list + Link existing / Create new
- Note editor top bar: shows linked curriculum topics + picker to add more
- Auto-link existing 100+ notes to topics on first seed (string matching)
- Reset-to-default action

### Out of scope (deferred to future phases)
- Embedding-based "suggested topic" UI on note save
- Inline edit / drag-reorder of curriculum content (user can edit via DB or future UI)
- Adding new tracks via UI (v1 only seeds 2 tracks; new tracks require DB insert)
- LLM-generated curricula
- Public templates / fork
- Linking topics to oss_projects, bookmarks, etc.

## Architecture

```
┌────────────────────────────────┐
│  /learn/map  (client)          │
│  - track tabs                  │
│  - grid: areas × topics        │
│  - side panel on topic click   │
└──────────────┬─────────────────┘
               │ tRPC
               ▼
┌────────────────────────────────┐
│  curriculum router             │
│  - getCurriculum(userId)       │
│  - setMastery(topicId, state)  │
│  - linkNote / unlinkNote       │
│  - createNoteForTopic          │
│  - resetToDefault              │
└──────────────┬─────────────────┘
               │ Drizzle
               ▼
┌────────────────────────────────┐
│  4 new tables                  │
│  curriculum_tracks             │
│  curriculum_areas              │
│  curriculum_topics             │
│  curriculum_topic_notes        │
└────────────────────────────────┘
```

Lazy-seed on first call to `getCurriculum`: if the user has zero `curriculum_tracks` rows, write the default 2 tracks + auto-link existing notes.

## Data model

### `curriculum_tracks`
| col          | type     | notes                            |
| ------------ | -------- | -------------------------------- |
| id           | text PK  | uuid                             |
| user_id      | text FK  | users.id, cascade                |
| title        | text     | "AI Engineer" / "Backend Architect" |
| description  | text     | nullable                         |
| icon         | text     | emoji                            |
| order_index  | int      | default 0                        |
| created_at   | ts       |                                  |
| updated_at   | ts       |                                  |

Index: `(user_id, order_index)`

### `curriculum_areas`
| col          | type     | notes                            |
| ------------ | -------- | -------------------------------- |
| id           | text PK  |                                  |
| track_id     | text FK  | curriculum_tracks.id, cascade    |
| title        | text     |                                  |
| description  | text     | nullable                         |
| order_index  | int      | default 0                        |
| created_at   | ts       |                                  |
| updated_at   | ts       |                                  |

Index: `(track_id, order_index)`

### `curriculum_topics`
| col          | type     | notes                                              |
| ------------ | -------- | -------------------------------------------------- |
| id           | text PK  |                                                    |
| area_id      | text FK  | curriculum_areas.id, cascade                       |
| parent_id    | text FK  | curriculum_topics.id, set null on delete (reserved)|
| title        | text     |                                                    |
| description  | text     | markdown, nullable                                 |
| mastery      | text     | enum, default 'blank'                              |
| order_index  | int      | default 0                                          |
| created_at   | ts       |                                                    |
| updated_at   | ts       |                                                    |

Indexes: `(area_id, order_index)`, `(area_id, parent_id)`
Mastery enum: `blank` | `heard` | `learning` | `mastered`

### `curriculum_topic_notes`
| col          | type    | notes                                |
| ------------ | ------- | ------------------------------------ |
| topic_id     | text FK | curriculum_topics.id, cascade        |
| note_id      | text FK | learning_notes.id, cascade           |
| created_at   | ts      |                                      |

PK: `(topic_id, note_id)` — natural dedup
Index: `(note_id)` — for reverse lookup in note editor

## Seed data

Hardcoded in `src/server/curriculum/seed-data.ts`:

- **AI Engineer**: 9 areas, ~101 topics
  - Foundations (12), Prompting & Reasoning (10), RAG Systems (15), Agents (13),
    Vector DB & Retrieval Infra (10), Production LLM Engineering (13),
    Fine-tuning & Post-training (10), Inference & Deployment (10), Multimodal (8)

- **Backend Architect**: 12 areas, ~137 topics
  - 计算机基础 (10), 编程语言 (15), 数据库 (15), Redis 与缓存 (12),
    消息队列 (10), 微服务架构 (13), 分布式系统 (13), 高并发系统设计 (13),
    容器与云原生 (10), 可观测性 (8), 安全 (10), 算法 (8)

(Full content embedded in seed-data.ts; see prior conversation thread for source draft.)

## Auto-link algorithm (v1)

On first `getCurriculum(userId)` for a user:

1. Insert tracks/areas/topics from seed data.
2. Fetch all `learning_notes` for the user.
3. For each note, find matching topics via:
   - Normalize titles (lowercase, strip punctuation/spaces)
   - Match if: bidirectional substring OR keyword Jaccard ≥ 0.7
   - Chinese tokenization: simple regex split + character-bigrams for fallback
4. Insert `(topic_id, note_id)` rows with `ON CONFLICT DO NOTHING`.
5. Update topics with at least one linked note: `mastery = 'learning'` (one-time bootstrap; no continuous rule).

Known limits:
- False positives (e.g. "Redis 学习" matching every Redis topic) — user manually unlinks via side panel
- False negatives (e.g. "DDD 是啥" vs "服务拆分原则（DDD）") — user manually links via side panel or note editor picker

## tRPC router (`curriculumRouter`)

```ts
curriculum.getCurriculum()
  // Returns full tree for current user.
  // Triggers lazy seed if user has zero tracks.

curriculum.setMastery({ topicId, mastery })
  // Updates curriculum_topics.mastery.

curriculum.linkNote({ topicId, noteId })
curriculum.unlinkNote({ topicId, noteId })

curriculum.createNoteForTopic({ topicId, title? })
  // Creates a new learning_note in a default learning_topic
  // (or a curriculum-managed default), then links it to topicId.
  // Returns the new note id for the client to navigate.

curriculum.getTopicsForNote({ noteId })
  // Returns curriculum_topics linked to this note. Used by note editor top bar.

curriculum.searchTopics({ query, limit? })
  // For the picker in note editor. Searches across all tracks for the user.

curriculum.resetToDefault()
  // Deletes all of the user's curriculum data and re-runs seed.
```

All procedures are `publicProcedure` with `ctx.userId` enforcement (project convention).

## UI

### `/learn/map` page

```
┌─────────────────────────────────────────────────────────┐
│  Curriculum Map                          [⚙ Reset]      │
│  ┌──────────────┬─────────────────┐                     │
│  │ AI Engineer  │ Backend Architect│  ← track tabs       │
│  └──────────────┴─────────────────┘                     │
│                                                          │
│  Coverage: 22/101 (22%)                                  │
│                                                          │
│  ▼ Foundations                                          │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ Trans..  │ Self-At..│ Multi-H..│ MHA/GQA..│         │
│  │ 🟢 mast.. │ ⚪ blank │ ⚪ blank │ ⚪ blank │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┐                                │
│  │ KV Cache │ Sliding..│  ...                            │
│  │ ⚪       │ ⚪       │                                  │
│  └──────────┴──────────┘                                │
│                                                          │
│  ▼ Prompting & Reasoning                                │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

- Each topic = a card. Color = mastery state.
- Color scheme:
  - `blank`  → muted gray border, transparent
  - `heard`  → light blue tint
  - `learning` → amber tint
  - `mastered` → green tint
- Hover shows a faint outline + cursor pointer.
- Clicking a topic opens the side panel (does not navigate).

### Side panel (slide-in from right)

```
┌─────────────────────────────────┐
│  ✕  Reranking 模型选型与时机     │
│                                  │
│  Mastery                         │
│  ( blank )(heard)(learning)(•••) │
│                                  │
│  Description                     │
│  Optional markdown               │
│                                  │
│  Linked notes (3)                │
│  ┌─────────────────────────────┐│
│  │ • Reranking 在 RAG 里的位置 ││  → click navigates
│  │ • Cross-encoder vs Bi-enc.. ││
│  │ • 查准率 / 召回率取舍       ││
│  └─────────────────────────────┘│
│                                  │
│  [+ Link existing note]          │
│  [+ Create new note]             │
└─────────────────────────────────┘
```

- "Link existing note" opens a search dialog over `learning_notes` (user's own).
- "Create new note" calls `createNoteForTopic`, navigates to the new note.

### Note editor top bar (in `/learn/[topicId]/[noteId]` or wherever notes are edited)

A compact tag row above the editor toolbar:

```
Curriculum: [Reranking 模型选型]  [Cross-encoder vs Bi-encoder]  [+]
```

- Tags are clickable → jump back to `/learn/map` and scroll to that topic
- "+" opens a picker dialog: search across all topics for the user, hierarchical tree (track → area), checkbox state shows current links

## State machine

Topic mastery state transitions are arbitrary — user can set any state at any time via the side panel. No state-derivation rules in v1.

Auto-link bootstrap rule: linked → bumps `blank` to `learning`. Runs **once** at seed time. No reverse rule (delete a note doesn't change mastery).

## Errors / edge cases

- Concurrent state update: last-write-wins, no optimistic locking. mastery is single-user data, conflicts unlikely.
- Note deleted while linked: cascade-cleans the link row, no UI action needed.
- User reset while side panel is open: panel state derives from server data, refetch on action completion will close it gracefully.
- Empty curriculum (resets failed mid-way): UI shows empty state with "Re-run seed" button.

## Production rollout

Schema change → must run on production Turso. Use existing `ops/turso-prod-rollout.sh` pattern (see CLAUDE.md §4). Verification: `SELECT name FROM sqlite_master WHERE name LIKE 'curriculum_%'` should return 4 tables.

## Testing

E2E in `e2e/curriculum-map.spec.ts`:
1. First visit triggers seed; user sees both tracks with topics
2. Auto-link populates some topics with linked notes
3. Click topic → side panel opens
4. Toggle mastery → state persists across refresh
5. Link a note → appears in panel and in note editor top bar
6. Create new note from topic → navigates and is auto-linked
7. Reset curriculum → state returns to default seed

Skip eval (this change does not touch RAG/agentic AI files per CLAUDE.md §3.1).

## Open follow-ups (post-v1)

- Embedding-based "Suggested topics" on note save
- Inline edit / drag-reorder of curriculum
- "Add new track" UI (currently only via DB seed)
- Track 3+ for other roles (Founder, SRE) — schema already supports
- Share/fork public templates — needs `is_public` + `forked_from_id` migration

## Decisions log

| # | Decision | Choice | Reason |
|---|----------|--------|--------|
| Q1 | Curriculum state vs note.mastery | C — independent | Need "heard but not noted" state |
| Q2 | Note → topic cardinality | A — many-to-many | Notes naturally span topics |
| Q3 | Mastery levels | B — 4 levels (blank/heard/learning/mastered) | "heard" is common initial state |
| Q4 | Curriculum ownership | B — per-user copy | Single-user product; flexibility |
| Q5 | Topic vs learning_topic relationship | A — fully independent | They model different concepts |
| Q6 | Phase 1 scope | Full v1 | User wants to validate end-to-end |
