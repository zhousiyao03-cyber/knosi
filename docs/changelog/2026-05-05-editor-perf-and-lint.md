# 2026-05-05 — Long-document editor perf + lint hygiene

## Why

User reported the Tiptap editor was sluggish on long notes (typing lag, IME stutter). Profiling pointed at two synchronous full-doc traversals on every keystroke. While verifying with `pnpm lint`, the local run produced ~50k phantom problems because `.next-e2e*` build artefacts were not in the ignore list — making lint useless as a local gate.

## What changed

### Editor perf — `src/components/editor/tiptap-editor.tsx`

`onUpdate` previously ran on every keystroke and did:

```ts
const json = JSON.stringify(currentEditor.getJSON()); // O(n) walk + serialize
const text = extractPlainTextFromContent(currentEditor.getJSON()); // 2nd O(n) walk
onChange?.(json, text);
```

Two issues:
1. The full document was traversed and stringified synchronously on the keystroke path. On a long note this stalls the input (especially under IME composition).
2. `getJSON()` was called twice — the result is not memoised internally.

Fix:
- **Coalesce** updates: `onUpdate` now only stashes the editor in a ref and arms a 250ms timer. The actual `getJSON`/stringify happens once per quiet window. Parent autosave is already debounced 1500ms (`note-editor-page-client.tsx:329`), so this introduces no perceptible save-latency change.
- **Reuse** the `getJSON()` result for both the JSON payload and the plain-text extraction (one tree walk instead of two).
- Flush any pending change synchronously on unmount so navigation never drops the last keystroke.

### Editor perf — `src/components/editor/inline-ask-ai-popover.tsx`

`InlineAskAiPopover` received `noteText: string` as a prop and Tiptap was passing `editor.getText()` on every parent render — another full-doc traversal triggered by unrelated state changes. Changed the prop to `getNoteText: () => string` so the full-text walk happens **once** at submit time, not on every render.

### Lint config — `eslint.config.mjs`

Added `**/.next-e2e*/**` to `globalIgnores`. Local `pnpm lint` after a Playwright run was scanning ~50k lines of compiled e2e fixtures and emitting ~5000 phantom errors. CI was clean (no e2e cache there), so the noise was strictly local — but enough to make `pnpm lint` worthless as a self-check tool.

After the fix:
- Before: `✖ 55449 problems (4986 errors, 50463 warnings)` — ~20s
- After:  `✖ 30 problems (17 errors, 13 warnings)` — ~9s

The remaining 17 are real, pre-existing React 19 strictness errors (`react-hooks/refs`, setState-in-effect cascade) scattered across 8 unrelated modules. Tracked as follow-up below — not bundled here so this commit stays reviewable.

## Files

- `src/components/editor/tiptap-editor.tsx` — defer onUpdate stringify, reuse getJSON, lazy noteText
- `src/components/editor/inline-ask-ai-popover.tsx` — `noteText` → `getNoteText` lazy getter
- `eslint.config.mjs` — ignore `.next-e2e*` build outputs
- `docs/changelog/2026-05-05-editor-perf-and-lint.md` — this entry

## Verification

- `pnpm build` — passed (TS + Next build clean)
- `pnpm lint` — 17 pre-existing errors only (down from 4986); no new errors introduced by this change
- `pnpm test:e2e` — skipped per project rule (worktree-style local run unreliable; CI gate covers this)

Manual smoke test: not run (user can poke a long note locally to confirm typing feels snappier).

## Follow-up — pre-existing lint errors to fix

These were already failing before this commit, surfaced now that lint is actually usable. Each is a real React 19 violation, but each needs careful behavior preservation, so they belong in their own commits:

- `src/app/(app)/drifter/drifter-client.tsx:45` — setState in effect
- `src/app/(app)/settings/analysis-prompts-section.tsx:75` — setState in effect
- `src/app/(app)/settings/providers/provider-edit-dialog.tsx:56` — setState in effect
- `src/app/(app)/settings/providers/role-row.tsx:67` — setState in effect
- `src/app/(app)/words/page.tsx:80,91,97` — refs during render + setState in effect
- `src/components/ask/use-local-chat.ts:117` — setState in effect
- `src/app/(app)/bookmarks/page.tsx` — refs during render
- `src/components/editor/excalidraw-block.tsx` — refs during render
- `src/components/editor/tiptap-editor.tsx:139,142,788,817,931,932` — refs during render (long-standing, not introduced here)
