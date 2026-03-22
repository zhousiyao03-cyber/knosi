# 2026-03-22 - Notes Editor Hover And Width Polish

## Task / Goal

修正笔记编辑器的两个体验问题：编辑区视觉不够接近 Notion，以及行级悬浮插入按钮在鼠标移向左侧时容易消失。

## Key Changes

- 将笔记编辑页主容器从 `max-w-3xl` 放宽到更接近 Notion 阅读宽度的布局。
- 移除编辑区外层的圆角边框与卡片阴影，改为更开放的画布式可编辑区域。
- 为行级悬浮插入增加 gutter 容错区域，在鼠标从 block 正文移动到左侧插入按钮时继续保持当前 block 激活。
- 同步扩大左侧悬浮区的实际命中范围，减少 hover 闪烁。

## Files Touched

- `docs/changelog/notes-editor-hover-width-polish.md`
- `src/app/notes/[id]/page.tsx`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `pnpm lint`
  - 通过
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 通过，`13 passed (9.6s)`

## Remaining Risks / Follow-up

- 当前 hover 容错逻辑仍然基于 DOM block 命中和 gutter 区域推断，已能解决按钮闪烁，但如果后续加入更复杂的块嵌套或拖拽排序，建议改成显式的块级 NodeView 或 block wrapper 结构。
