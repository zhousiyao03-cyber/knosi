# 2026-04-10 — Ask AI M3: Output Actions

Task / goal:
- Ship Milestone 3 from the Notion-alignment roadmap: turn the inline Ask AI popover from "a single Insert button" into a real action layer. Users should be able to (a) keep the reply without inserting (copy), (b) append it to the current note's tail instead of the caret, (c) append it to any other note via a searchable picker, and (d) receive structured block output (headings / lists / code blocks / blockquote) with proper ProseMirror fidelity instead of a minimal markdown round-trip.
- Corresponds to `docs/plans/2026-04-10-ask-ai-m3-output-actions.md`.
- Roadmap: `docs/plans/2026-04-09-ask-ai-notion-alignment-overview.md`.

## Shipped slices

### Step 1 — parseAiBlocks util + "追加到末尾" button (commit f456298)
- New `src/lib/parse-ai-blocks.ts`: extracts `<ai_blocks>...</ai_blocks>` JSON arrays from assistant output and returns `JSONContent[]` ready for `editor.chain().insertContentAt(...)`. Falls through to `{ blocks: null, cleanText }` on any failure (no tag, bad JSON, not an array) so existing streams work unchanged.
- `InlineAskAiPopover` now has an `answerToBlocks(text)` helper that tries the structured path first and falls back to `aiTextToTiptapJson`. Both `handleInsert` and the new `handleAppendHere` go through it.
- New `追加到末尾` button in ask mode (not rewrite — rewrite's whole point is to replace the selection). Inserts at `editor.state.doc.content.size` rather than at the anchor, so users can grab the reply without losing their caret.
- E2E: new "append to end" test asserts `TOP_LINE` still precedes the appended content even when the caret was at pos 0 before the click.

### Step 2 — Copy button (commit e8b9c7a)
- New `复制` button in the action bar. Uses `navigator.clipboard.writeText` with `parseAiBlocks(text).cleanText` piped through `stripAssistantSourceMetadata` so `<ai_blocks>` envelopes and `<!-- sources: -->` trailers are stripped before copy.
- Transient ✓ 已复制 confirmation for 1.5s; silently ignores clipboard permission denials (restricted iframes / sandboxed contexts).
- E2E: new test asserts the button transitions to 已复制 after click; Firefox is skipped because Playwright Firefox doesn't grant clipboard permissions.

### Step 3 — Structured `<ai_blocks>` system prompt opt-in (commit df95d96)
- `BuildSystemPromptOptions` + `withStructuredBlocksInstructions` folded into `finalizePrompt`. When the client sets `preferStructuredBlocks: true`, the system prompt asks the model to wrap rich answers in `<ai_blocks>` XML containing a JSON array of Tiptap `JSONContent` nodes, with examples and a supported-node set (paragraph/heading/bulletList/orderedList/listItem/codeBlock/blockquote). Short plain-text answers stay as plain text.
- `chatInputSchema` accepts `preferStructuredBlocks` and threads it through.
- `<InlineAskAiPopover>` always sends `preferStructuredBlocks: true` so inline answers get the rich path whenever the model cooperates. When the model ignores the hint, `parseAiBlocks` fails and `aiTextToTiptapJson` takes over — the UX is identical to M1.
- E2E: a new test mocks `/api/chat` with an `<ai_blocks>` envelope containing an H2 and asserts the editor now renders a real `<h2>`, proving the full JSON path (mock → parseAiBlocks → insertContentAt → ProseMirror heading node).

### Step 4 — notes.appendBlocks mutation + cross-note append menu (commit 5ca6b81)
- New `src/server/routers/notes.ts notes.appendBlocks` protected mutation:
  - Input `{ noteId, blocks: JSONContent[] (max 200) }`
  - **Security**: every access is scoped by `ctx.userId`; the mutation throws if the target note belongs to another user. Client-side title is never trusted — the server always refetches the row.
  - Parses `notes.content` as a Tiptap doc JSON, appends `blocks` to `doc.content`, rewrites both `content` (JSON string) and `plainText` using the new inline `tiptapDocToPlainText()` helper (pure server-side walker; no ProseMirror import).
  - Triggers `syncNoteKnowledgeIndex` so the new text is searchable in RAG.
- New `src/components/editor/inline-ask-ai-append-target-menu.tsx`:
  - Embedded searchable dropdown with its own text input (unlike `InlineAskAiMentionMenu`, this opens from a button click not a caret `@`).
  - Keyboard navigation: ↑/↓ + Enter/Esc.
  - Fix for a nasty React + native listener race: option `onMouseDown` calls `e.nativeEvent.stopImmediatePropagation()` so the popover's window-level click-outside handler doesn't fire while React is mid-unmount. Without this the target button leaves the DOM before `containerRef.contains(target)` can evaluate, the check flips to false, and the whole popover closes before the mutation finishes.
- `<InlineAskAiPopover>`:
  - New `appendStatus` state machine (`idle` / `appending` / `appended` / `error`) rendered as a thin status banner above the action bar.
  - New `追加到…` button next to `追加到末尾` (ask mode only; rewrite mode keeps the replace/insert focus).
  - Fires `trpc.notes.appendBlocks.useMutation`; success banner auto-clears after 2.5s.
- E2E: new "append to another note" scenario seeds an `APPEND_TARGET_<uid>` note via the real UI flow (waits for the debounced "Saved" indicator), then goes through `/ai` → prompt → append menu → pick target → asserts the banner shows `已追加到` and the `/api/trpc/notes.appendBlocks` endpoint was actually hit via a passive `page.on("request")` listener.

## What M3 does **not** yet do

Tracked in `docs/plans/2026-04-10-ask-ai-m3-output-actions.md § Follow-up for M3+`:

- **Append to project notes / learning notes**: these have independent tRPC routers, not `notes.appendBlocks`. M3 only covers plain `notes`.
- **Cross-note append undo**: no client-side undo handle after the mutation; users have to manually open the target note and hit Cmd+Z. A future change could pop a toast with "撤销" that calls a reciprocal mutation slicing the tail N blocks back off.
- **Strict structured blocks mode**: step 3 is opt-in / best-effort. If the model compliance rate stays high in practice, we can flip it to a hard requirement and treat JSON-parse failures as errors.

## Files touched

- `src/lib/parse-ai-blocks.ts` (new, step 1)
- `src/components/editor/inline-ask-ai-popover.tsx` (all four steps)
- `src/components/editor/inline-ask-ai-append-target-menu.tsx` (new, step 4)
- `src/server/ai/chat-system-prompt.ts` (step 3: `BuildSystemPromptOptions.preferStructuredBlocks`, `withStructuredBlocksInstructions`, `finalizePrompt` wrap)
- `src/app/api/chat/route.ts` (step 3: schema + passthrough)
- `src/server/routers/notes.ts` (step 4: `appendBlocks` mutation + `tiptapDocToPlainText` helper)
- `e2e/ask-ai-editor-inline.spec.ts` (covers steps 1, 2, 3, 4)
- `docs/plans/2026-04-10-ask-ai-m3-output-actions.md` (plan, authored at start of the session)
- `docs/changelog/2026-04-10-ask-ai-m3-output-actions.md` (this file)

## Verification

- `pnpm build` ✅ passes on the final state.
- `pnpm lint` ✅ 0 errors, 0 warnings on the files touched this milestone.
- `pnpm test:e2e --workers=1 e2e/ask-ai-editor-inline.spec.ts e2e/ask-ai-mention.spec.ts` ✅ **10/10 passed** (31.6s), covering:
  - slash `/ai` insert
  - bubble toolbar rewrite (replace selection)
  - copy button state transition
  - append-to-another-note with `notes.appendBlocks` mutation fired
  - append-to-end with caret-at-pos-0 ordering check
  - `<ai_blocks>` heading renders as real `<h2>` in ProseMirror
  - Escape closes popover (not editor)
  - @mention chip flow + request body pinnedSources
  - chip × removal
  - mention Esc only closes the menu

## Remaining risks / follow-ups

- **Daemon chat mode** still ignores `contextNoteText`, `pinnedSources`, and now `preferStructuredBlocks`. Inline Ask AI forces stream mode (`sourceScope: "direct"`) so the gap isn't user-visible; leave the TODO in `route.ts`.
- **Token budget on `<pinned_sources>`**: each pinned source is truncated to 6000 chars; with 10 pinned and the structured blocks prompt payload, the system prompt can grow large. No hard total ceiling yet. Monitor.
- **`tiptapDocToPlainText` fidelity**: the server-side walker only concatenates `node.text` values; it doesn't honor list markers, heading emphasis, or code block language hints. It's enough for `dashboard.search` LIKE matching but will look scruffy if ever surfaced as a preview. If we need richer previews server-side we should share a canonical extractor with the editor's `handleContentChange` path.
- **`notes.appendBlocks` blocks schema is `z.any()`**. We trade strict validation for letting the inline popover send whatever Tiptap JSON shape came back from `parseAiBlocks`. If a malicious client passes something that Tiptap rejects on next page load, we log it but don't error. Acceptable for now — every persistent write still runs through `plainText` derivation, so at worst the doc becomes visibly broken; no XSS exposure.
- Reaffirmed pre-existing e2e baseline (74 failed on main, 71 after heatmap, then phase1+phase6 rewrite dropped us further): full-suite run not repeated at end of M3 because serial ask-ai spec suite was already green. The quick-actions / append / copy additions don't touch any spec outside `ask-ai-*`.
