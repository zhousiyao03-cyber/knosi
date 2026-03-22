# 2026-03-22 - Notes Editor Left Padding Fix

## Task / Goal

去掉笔记编辑区额外的左侧内容缩进，同时保留行级悬浮插入按钮的可达性和稳定性。

## Key Changes

- 移除编辑区容器上的 `pl-14`，让正文重新从正常内容起点开始排版。
- 去掉编辑区外层额外的 `py-2`，收紧正文上下留白。
- 将左侧插入控件改为浮在内容区外侧，而不是通过给正文让位来留出空间。
- 扩大 gutter 容错范围，保证正文不缩进后，鼠标从正文移动到插入按钮时 hover 仍然稳定。

## Files Touched

- `docs/changelog/notes-editor-left-padding-fix.md`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `pnpm lint`
  - 通过
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 通过，`13 passed (9.3s)`

## Remaining Risks / Follow-up

- 当前控件是通过浮层方式挂在内容外侧的，已经不会再挤压正文；如果后续要继续补块拖拽或更复杂的 block 操作，建议统一成更明确的 block wrapper / node view 方案。
