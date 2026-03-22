# 2026-03-22 - Notes Editor Notion Refactor

## Task / Goal

将笔记编辑器重构为更接近 Notion 的块编辑体验，重点修复图片无法插入、Todo / 列表不可靠，以及块级插入交互不符合预期的问题。

## Key Changes

- 为 Tiptap 编辑器补齐图片节点能力，支持本地上传、拖拽粘贴和直接粘贴图片。
- 移除顶部常驻工具栏，改为 Notion 风格的行级悬浮插入按钮，并复用统一的块命令菜单。
- 统一块命令模型，让 Slash 命令和行级插入按钮共用同一套标题、列表、Todo、引用、代码块、分割线和图片插入能力。
- 增强编辑器样式，补齐图片、任务列表、选中态和更接近 Notion 的正文块间距。
- 为笔记编辑页接入图片插入失败提示，并在切换笔记时强制重建编辑器实例，降低状态串页风险。
- 新增 Phase 2 E2E 覆盖，验证悬浮插入按钮、无序列表、Todo 勾选和本地图片插入保存。

## Files Touched

- `package.json`
- `pnpm-lock.yaml`
- `README.md`
- `docs/changelog/notes-editor-notion-refactor.md`
- `e2e/phase2.spec.ts`
- `src/app/globals.css`
- `src/app/notes/[id]/page.tsx`
- `src/components/editor/editor-commands.ts`
- `src/components/editor/slash-command.tsx`
- `src/components/editor/tiptap-editor.tsx`

## Verification Commands And Results

- `pnpm lint`
  - 通过
- `pnpm test:e2e e2e/phase2.spec.ts`
  - 通过，`13 passed (9.3s)`
- `pnpm build`
  - 通过，Next.js 16 生产构建与 TypeScript 检查成功

## Remaining Risks / Follow-up

- 当前图片仍以内嵌 base64 方式写入 SQLite，便于本地原型快速可用，但大图会放大笔记体积；后续可切到文件存储或对象存储。
- 行级插入按钮目前实现了插入入口和菜单，没有实现 Notion 那种拖拽排序手柄；如果后续要继续对齐，可补块级拖拽与块菜单。
- 当前限制本地图片格式为 PNG、JPG、WEBP、GIF，且单张不超过 5MB；如果后续需要更宽松的媒体能力，需要同步扩展校验和存储策略。
