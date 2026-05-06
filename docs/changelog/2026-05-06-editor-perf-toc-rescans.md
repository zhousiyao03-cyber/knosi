# 2026-05-06 — Editor long-doc perf: coalesce TOC rescans

## Why

User reported the Tiptap editor was still laggy on long notes after [2026-05-05-editor-perf-and-lint](2026-05-05-editor-perf-and-lint.md), which deferred the parent's `onUpdate` serialization. Investigation found two more synchronous full-doc walks on the keystroke path that bypass that coalescing entirely:

- `TocSidebar` (always rendered next to the global sidebar on 2xl screens) registers its own `editor.on("update", ...)` listener that runs `editor.state.doc.descendants(...)` on every transaction and calls `setHeadings(...)`.
- `TocBlock` NodeView (rendered only when the user has a `/toc` block) does the same.

`useEditor`'s `shouldRerenderOnTransaction` defaults to `false` in @tiptap/react v3, so the parent `TiptapEditor` does not re-render per keystroke — but these per-component update listeners are independent of that and were the dominant remaining O(n) cost on long docs.

## What changed

### `src/components/editor/toc-sidebar.tsx`, `src/components/editor/toc-block.tsx`

Both now coalesce rescans behind a 300ms quiet-window timer:

- On `editor.on("update", ...)`, instead of immediately walking + setState, arm a single `setTimeout` if none is pending.
- Inside the timer, `scanHeadings(editor)` runs once and the result is compared to the previous headings via shallow structural equality (length + per-entry `pos`/`level`/`text`). If identical, return `prev` to skip React reconciliation entirely.
- Cleanup on unmount clears any pending timer.

Net effect on a long note: the per-keystroke cost drops from O(doc-size) `descendants()` walk + setState + heading-list reconciliation to O(1) timer-arming. Headings still update during a typing pause (300ms), which is imperceptible for a TOC.

`TocSidebar`'s `selectionUpdate` listener (used to highlight the active heading) is left as-is — it's already O(headings) on a ref, not O(doc), and selection-only changes do not trigger the rescan.

## Files

- `src/components/editor/toc-sidebar.tsx` — debounce + structural-equality bailout for `update` listener
- `src/components/editor/toc-block.tsx` — same
- `docs/changelog/2026-05-06-editor-perf-toc-rescans.md` — this entry

## Verification

- `pnpm build` — TypeScript compiled successfully (`Compiled successfully in 33.9s` / `Finished TypeScript in 54s`). Build failed at page-data collection because the worktree has no `data/second-brain.db` (environment issue, not from this change).
- `pnpm lint` — `0 errors, 13 warnings`, all pre-existing in unrelated files. No new errors/warnings introduced.
- `pnpm test:e2e` — skipped per project rule (worktree-style local Playwright run unreliable; CI gate covers this).

Manual smoke test: not run automatically (no local DB in worktree). User can confirm by typing in a long note that has many headings and observing whether keystrokes feel snappier; the TOC sidebar will continue to update, just with up to 300ms of latency after a typing pause instead of synchronously per key.

## Why not other suspects

While investigating I also examined the following and ruled them out as the dominant cost for general long docs:

- `BubbleToolbar` / `TableToolbar` — listen to `selectionUpdate` (and `transaction` in TableToolbar's case), but `setVisible(false)` on the no-table path bails React via shallow equality, and the `editor.isActive(...)` check is O(selection-depth), not O(doc).
- `MermaidBlock` / `ExcalidrawBlock` — atom NodeViews keyed only on their own attrs; far-away keystrokes don't re-render them.
- `wiki-link-trigger` — short-circuits with `if (!isActive) return` outside an active `[[` query.
- `MarkdownTablePaste` — only runs in `handlePaste`, not on keystroke.
- `useEditor` itself — confirmed via @tiptap/react v3 source (`useEditor.ts` line 368) that `shouldRerenderOnTransaction` defaults to `false`, so the parent doesn't re-render per keystroke.

## Follow-ups (not bundled)

- `TableToolbar` registers both `selectionUpdate` and `transaction` for the same callback; `transaction` covers `selectionUpdate`, so the duplicate could be removed. Tiny win, separate cleanup.
- For users with very large code blocks, `CodeBlockLowlight` runs syntax highlighting via decorations on every doc change in the changed block. Tiptap-internal and harder to fix without forking; revisit only if profiling shows it dominates.
