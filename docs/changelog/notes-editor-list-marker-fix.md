# 2026-03-22 - Notes Editor List Marker Fix

## Task / Goal

修复笔记编辑器中无序列表和有序列表结构存在但 marker 没有渲染出来的问题。

## Key Changes

- 为 `.notion-editor` 下的 `ul` 和 `ol` 显式恢复 `list-style-type`，避免被 Tailwind preflight 的全局 reset 吃掉。
- 为嵌套列表补充基础 marker 样式，无序列表使用 `circle`，有序列表使用 `lower-alpha`。
- 扩展 Phase 2 E2E，除了检查列表节点和文本外，也校验浏览器实际计算出的 `list-style-type`。
- 新增有序列表回归测试，覆盖数字列表的插入与渲染。

## Files Touched

- `docs/changelog/notes-editor-list-marker-fix.md`
- `e2e/phase2.spec.ts`
- `src/app/globals.css`

## Verification Commands And Results

- `pnpm lint`
  - 待本次变更后执行
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 待本次变更后执行

## Remaining Risks / Follow-up

- 当前回归验证的是浏览器计算出的 `list-style-type`，可以覆盖 marker 被 reset 的问题；如果后续引入自定义 marker UI，再调整测试断言方式会更稳妥。
