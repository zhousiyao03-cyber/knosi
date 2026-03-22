# Work Log

Append one entry for every non-trivial task delivered in this repository.

## 2026-03-21 - Repository Baseline Review

Task / goal:
- Review Phase 1 completion quality and add stronger execution constraints for future agent work.

Key changes:
- Expanded `AGENTS.md` into a project working agreement.
- Replaced the default `README.md` with project-specific status and workflow guidance.
- Added this work log as the required handoff record.

Files touched:
- `AGENTS.md`
- `README.md`
- `docs/WORK_LOG.md`
- `.gitignore`

Verification commands and results:
- `sqlite3 data/second-brain.db ".tables"` -> confirmed 8 expected tables exist.
- `sqlite3 data/second-brain.db "pragma integrity_check;"` -> `ok`.
- `node`, `npm`, and `pnpm` were not available in PATH in the current terminal, so runtime checks such as `pnpm dev`, `pnpm lint`, and `pnpm build` could not be executed here.

Remaining risks / follow-up:
- Add a working Node.js toolchain to the environment and run `pnpm lint`, `pnpm build`, and at least one navigation e2e flow before calling Phase 1 fully verified.
- Add test infrastructure so future UI and data changes can be self-verified automatically.

## 2026-03-21 - Todo Usability Refresh

Task / goal:
- Rework the Todo module so it is usable for real daily planning, with time management, editing, and clearer list organization.

Key changes:
- Rebuilt the Todo page around quick capture plus expandable metadata fields.
- Added due date, category, and description support to the creation and editing flows.
- Reorganized the list into overdue, today, upcoming, no-date, and completed sections.
- Added an inline detail editor and fixed clearing due dates all the way through the router layer.
- Updated Todo E2E coverage to match the new UI and verify the core CRUD flow.
- Refined the visual language so the page feels like a daily tool instead of a generic admin screen.
- Switched categories from free-text entry to a controlled select list.
- Replaced the old datetime input with quick date actions plus separate date/time controls.
- Added collapsing for long no-date/completed sections and auto-focus for newly created tasks.

Files touched:
- `src/app/todos/page.tsx`
- `src/server/routers/todos.ts`
- `e2e/phase3.spec.ts`
- `docs/changelog/phase-3.md`
- `docs/WORK_LOG.md`

Verification commands and results:
- `pnpm rebuild better-sqlite3` -> rebuilt the native module successfully for Node `v20.10.0`.
- `pnpm build` -> passed.
- `pnpm lint` -> passed with 1 pre-existing warning in `src/components/editor/slash-command.tsx`.
- `pnpm exec playwright test --grep "Phase 3: Todo 模块"` -> 7/7 passed.
- `pnpm exec playwright test` -> still fails in `e2e/phase2.spec.ts` because note-editor tests target the old note UI (`input[placeholder='笔记标题']`, old toolbar selectors).

Remaining risks / follow-up:
- Full-repo E2E remains blocked by the in-flight note editor rewrite.
- Todo still lacks drag sorting and notification/reminder behavior from the original Phase 3 wishlist.

## 2026-03-22 - Full Validation After Editor Merge

Task / goal:
- Re-run repository-wide validation after the parallel note editor work landed, and remove the last flaky E2E blocker outside the Todo module.

Key changes:
- Stabilized the learning-module seed-path Playwright test by switching to a role-based button locator and a click strategy that tolerates the button's loading-state re-render.
- Rebuilt `better-sqlite3` for the current Node runtime so production builds could execute again.
- Re-ran full-repo build and end-to-end validation against the combined Todo and note-editor changes.

Files touched:
- `e2e/phase5.spec.ts`
- `docs/changelog/phase-5.md`
- `docs/WORK_LOG.md`

Verification commands and results:
- `pnpm rebuild better-sqlite3` -> rebuilt successfully for Node `v20.10.0`.
- `pnpm build` -> passed.
- `PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test --reporter=line` -> `66 passed (18.3s)`.

Remaining risks / follow-up:
- Local environments that switch Node major versions will need to rebuild `better-sqlite3` before running `pnpm build`.
- Todo still does not include reminders or drag-based ordering.
