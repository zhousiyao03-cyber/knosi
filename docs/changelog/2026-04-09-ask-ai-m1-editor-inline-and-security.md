# 2026-04-09 — Ask AI M1 (editor inline) + cross-user RAG leak fix

Two related streams of work shipped on the same day while rebuilding the
Ask AI experience toward Notion parity.

## 1. Ask AI M1 — Editor inline

Bring Ask AI out of the `/ask` shell and into the Tiptap editor itself.

### Key changes

- `src/lib/ai-text-to-tiptap.ts` — plain text → Tiptap `JSONContent[]`
  conversion (headings / bullet lists / fenced code / paragraphs).
- `src/components/editor/inline-ask-ai-popover.tsx` — streaming mini
  composer anchored at caret or selection, with Insert / Replace /
  Discard actions. Closes on Esc and click-outside.
- `src/components/editor/tiptap-editor.tsx` — mounts the popover and
  listens for the global `open-inline-ask-ai` custom event.
- `src/components/editor/editor-commands.ts` — new `AI` group with an
  `Ask AI` slash entry (`/ai`). Dispatches the custom event anchored at
  the caret.
- `src/components/editor/bubble-toolbar.tsx` — leftmost Sparkles button
  that dispatches the event with the current selection text + range
  (rewrite mode).
- `src/server/ai/chat-system-prompt.ts` — new `{ contextNoteText }`
  option. When present, the current note's plain text is appended to
  the system prompt inside `<current_note>` so the assistant can
  resolve "this note" / "the text above" references.
- `src/app/api/chat/route.ts` — schema accepts `contextNoteText` and
  passes it to `buildSystemPrompt`. Daemon branch leaves a TODO: inline
  Ask AI uses stream mode + `sourceScope="direct"`, so daemon-mode
  inline is out of scope for M1.

### Files touched

- src/lib/ai-text-to-tiptap.ts (new)
- src/components/editor/inline-ask-ai-popover.tsx (new)
- src/components/editor/tiptap-editor.tsx
- src/components/editor/editor-commands.ts
- src/components/editor/bubble-toolbar.tsx
- src/server/ai/chat-system-prompt.ts
- src/app/api/chat/route.ts

### Verification

- `pnpm build` ✅ (multiple times through the series)
- `pnpm lint` ✅ on touched files
- E2E pending — will be added in a follow-up once the inline experience
  stabilizes (no ask-ai e2e existed before M1 either)

## 2. Ask AI UI redesign (toward Notion)

Separate visual track, same day.

- Empty state: Sparkles circle + "今日事，我来帮。" headline at 18vh,
  composer sits directly underneath at `max-w-2xl`.
- Composer: thin 2xl border, blue focus ring, left-side `+` (disabled
  placeholder) and `⚙` scope dropdown, right-side clear / mic
  (disabled) / circular ArrowUp send.
- Quick prompts: 4 compact icon cards in a drawer under the composer.
- Message state: flat layout, no Bot avatar, no "ASK AI" label, no big
  bordered card around sources/actions. Replies are plain prose with a
  minimal borderless icon action row + inline source chips.
- User bubble: thin gray capsule with no shadow/ring.
- Localized loading + error copy.

## 3. 🔴 Security fix: cross-user RAG leak

### The bug

`retrieveContext` and `retrieveAgenticContext` both scanned the full
`notes` / `bookmarks` / `knowledge_chunks` tables with **no userId
filter**. `/api/chat` called them without a userId. Result: any logged
in user's Ask AI request could retrieve — and have cited — content
belonging to other users. Surfaced when asking the assistant to
summarize "最近的 notes" and seeing another user's notes mixed in.

### The fix — two commits

#### Step A — emergency fail-closed patch (commit `4eb8b77`)

- `retrieveContext({ userId })`: filters `notes` / `bookmarks` by
  `userId`. Returns `[]` if userId is missing.
- `retrieveAgenticContext({ userId })`: because `knowledge_chunks` had
  no user_id column yet, it derived ownership by intersecting the
  current user's note/bookmark ids with chunk.sourceId in memory.
  Also fail-closed.
- `/api/chat` and `chat-enqueue` (daemon path) pass session userId into
  both helpers.

#### Step B — proper schema fix (commit `cc28cc9`)

- `knowledge_chunks` gets a `user_id text` column + FK + index.
  Drizzle migration 0022.
- `indexer.ts` always sets `userId` on insert, derived from
  `note.userId` / `bookmark.userId`.
- `agentic-rag.ts` stops doing in-memory intersection and uses a single
  SQL `where eq(knowledge_chunks.userId, userId)` against the index.
- `scripts/db/apply-2026-04-09-knowledge-chunks-user-id.mjs` is an
  idempotent rollout script: ADD COLUMN IF MISSING, CREATE INDEX IF
  MISSING, backfill `user_id` from notes/bookmarks, delete orphan
  chunks whose owning source is gone, verify zero NULLs.

### Production rollout

- **Local libsql**: 11 chunks → 7 backfilled + 4 orphans pruned → 0 NULL.
- **Production Turso** (`libsql://database-bisque-ladder-...turso.io`):
  50 chunks → 50 backfilled → 0 NULL. Distribution confirmed two
  distinct users (`5dcad5a2...` with 43 chunks, `85ecae04...` with 7),
  proving the pre-fix bug was not theoretical.

### Verification commands

```bash
# Local
node scripts/db/apply-2026-04-09-knowledge-chunks-user-id.mjs

# Production
set -a && source .env.turso-prod.local && set +a \
  && node scripts/db/apply-2026-04-09-knowledge-chunks-user-id.mjs
```

Both ended with `✅ knowledge_chunks.user_id rollout complete`.

## Remaining risks / follow-ups

- No automated e2e for inline Ask AI yet. Tracking for a follow-up.
- Daemon chat branch still ignores `contextNoteText` in
  `/api/chat/route.ts` (TODO comment). OK because inline uses stream
  mode.
- The popover's `editor.getText()` is called at mount; fine for normal
  notes, could be slow for very long documents (>100k chars).

## Commits

- `4665b25` feat(ask-ai): redesign Ask AI page UI toward Notion style
- `6af612f` feat(ask-ai): aiTextToTiptapJson util + plumb contextNoteText
- `a30953e` feat(ask-ai): inline Ask AI popover (M1 part 1)
- **`4eb8b77` fix(security): scope Ask AI RAG retrieval to current user**
- `5c85ff3` feat(ask-ai): simplify message-state UI toward Notion look
- **`cc28cc9` fix(security): add user_id column to knowledge_chunks (Step B)**
- (this commit) feat(ask-ai): bubble-toolbar Ask AI button + changelog
