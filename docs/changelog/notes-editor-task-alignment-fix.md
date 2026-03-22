# 2026-03-22 - Notes Editor Task Alignment Fix

## Task / Goal

修复 Todo 项中复选框与文字首行没有垂直居中的问题。

## Key Changes

- 去掉 Todo 复选框容器上依赖 `margin-top` 的硬编码偏移。
- 将复选框容器改为按首行高度居中对齐，并把 checkbox 本身设为 `display: block` + `margin: 0`。
- 保持任务文字行高稳定，避免出现文字视觉上偏高的情况。

## Files Touched

- `docs/changelog/notes-editor-task-alignment-fix.md`
- `src/app/globals.css`

## Verification Commands And Results

- `pnpm lint`
  - 待本次变更后执行
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 待本次变更后执行

## Remaining Risks / Follow-up

- 当前对齐策略优先保证单行 Todo 的视觉居中；如果后续需要进一步贴近 Notion 的多行任务表现，可以再单独微调多行时 checkbox 的顶部对齐策略。
