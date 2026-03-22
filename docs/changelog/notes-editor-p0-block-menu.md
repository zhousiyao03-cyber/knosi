# 2026-03-22 - Notes Editor P0 Block Menu

## Task / Goal

实现笔记编辑器的 P0 对齐项：把左侧悬浮区从单纯的 `+` 入口升级为更接近 Notion 的块级操作基础版，包括真正的插入语义和块菜单操作。

## Key Changes

- 为编辑器新增顶层 block 操作 helper，统一处理块定位、聚焦、复制、删除、上下移动和相对位置插入。
- 将左侧 `+` 改为真正的“插入新块”入口：
  - 默认在当前块下方插入
  - 按住 `Option` 点击时在当前块上方插入
  - 选择块类型后再执行插入，而不是直接改写当前块
- 将左侧 `⋮⋮` 句柄升级为块菜单入口，支持：
  - 上移
  - 下移
  - 复制块
  - 删除块
  - 将当前块转为正文、标题、列表、待办、引用、代码块等基础块
- 为图片插入补上“按指定位置插入”的能力，使左侧插入菜单选择图片时能插到目标块上方或下方，而不是只能依赖当前光标。
- 为插入菜单、块菜单和 slash 菜单增加稳定的测试标识，并支持点击外部关闭。
- 扩展 Phase 2 E2E，覆盖：
  - `+` 插入新块而非改写当前块
  - 块菜单复制/删除
  - 块菜单上下移动

## Files Touched

- `README.md`
- `docs/changelog/notes-editor-p0-block-menu.md`
- `e2e/phase2.spec.ts`
- `src/components/editor/editor-block-ops.ts`
- `src/components/editor/editor-commands.ts`
- `src/components/editor/slash-command.tsx`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `pnpm lint`
  - 通过
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 通过，`17 passed (11.2s)`
- `pnpm build`
  - 通过，Next.js 16 生产构建与 TypeScript 检查成功

## Remaining Risks / Follow-up

- 当前块菜单已经具备 P0 级操作，但 `⋮⋮` 仍未实现真正的拖拽排序，只提供上下移动。
- “转为”当前还是基础块集合，不包含 toggle、callout、bookmark/embed、table、mention 等下一阶段要补的 Notion 高阶块。
- 左侧 hover 和块定位目前仍是 DOM + 顶层 block 推断方案；如果后续继续补复杂嵌套块或拖拽，建议演进为显式 block wrapper / node view 结构。
