# 2026-04-09 — Page performance governance

## Goal

完成 V2 的 `页面性能治理` 第一轮落地，先解决高频页面的首屏负担、server/client 边界过重、全局搜索默认挂载、以及性能优化过程中引入的 SSR / e2e 回归问题。

## Key changes

- 将高频路由入口改为更轻的 Server Component 包装层，并把原本的大体量 client 页面下沉到独立组件：
  - `src/app/(app)/page.tsx`
  - `src/app/(app)/notes/page.tsx`
  - `src/app/(app)/notes/[id]/page.tsx`
  - `src/app/(app)/ask/page.tsx`
  - `src/components/dashboard/dashboard-page-client.tsx`
  - `src/components/notes/notes-page-client.tsx`
  - `src/components/notes/note-editor-page-client.tsx`
  - `src/components/ask/ask-page-client.tsx`
- Dashboard / Notes / Note detail 现在由 server route 预取首屏数据后再交给 client shell，避免这些页面每次先空白 hydration 再补发请求。
- Ask AI 页面在 server 侧就解析 chat mode，不再依赖 client mount 后额外请求 `/api/config`。
- 新增按需加载的全局搜索弹层，避免搜索模态在每个页面初始渲染时一并挂载：
  - `src/components/search-dialog.tsx`
  - `src/components/search-dialog-modal.tsx`
- 编辑器相关组件做了几处“减少无意义同步重置 / 默认不挂载重 UI”的修正，降低不必要的 re-render 和 effect 抖动：
  - `src/components/editor/tiptap-editor.tsx`
  - `src/components/editor/inline-ask-ai-popover.tsx`
  - `src/components/editor/search-replace.tsx`
  - `src/components/editor/toc-block.tsx`
  - `src/components/editor/toc-sidebar.tsx`
  - `src/components/editor/knowledge-note-editor.tsx`
  - `src/components/editor/mermaid-block.tsx`
- 新增统一的 request-session helper，让 `AUTH_BYPASS` 在 server entrypoint / auth page / settings action 里保持一致，避免 Playwright 因 server route 直接 `auth()` 又掉回 `/login`：
  - `src/server/auth/request-session.ts`
  - `src/app/(app)/layout.tsx`
  - `src/app/login/page.tsx`
  - `src/app/register/page.tsx`
  - `src/app/(app)/settings/page.tsx`
  - `src/app/(app)/settings/actions.ts`
- 修复性能优化中引入的一个回归：当 note 详情页 SSR 首次没查到记录时，不再直接锁死在 `Note not found`，而是允许 client 侧做一次恢复查询，避免新建笔记后立刻进入编辑页时出现误判。
- 增加两层回归护栏：
  - source-level regression：`src/server/performance-governance.test.mjs`
  - e2e smoke regression：`e2e/performance-governance.spec.ts`

## Files touched

- `src/app/(app)/layout.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/notes/page.tsx`
- `src/app/(app)/notes/[id]/page.tsx`
- `src/app/(app)/ask/page.tsx`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/actions.ts`
- `src/components/dashboard/dashboard-page-client.tsx`
- `src/components/notes/notes-page-client.tsx`
- `src/components/notes/note-editor-page-client.tsx`
- `src/components/ask/ask-page-client.tsx`
- `src/components/search-dialog.tsx`
- `src/components/search-dialog-modal.tsx`
- `src/components/editor/tiptap-editor.tsx`
- `src/components/editor/inline-ask-ai-popover.tsx`
- `src/components/editor/search-replace.tsx`
- `src/components/editor/toc-block.tsx`
- `src/components/editor/toc-sidebar.tsx`
- `src/components/editor/knowledge-note-editor.tsx`
- `src/components/editor/mermaid-block.tsx`
- `src/server/auth/request-session.ts`
- `src/server/performance-governance.test.mjs`
- `e2e/performance-governance.spec.ts`
- `docs/changelog/2026-04-09-page-performance-governance.md`

## Verification

- `node --test src/server/performance-governance.test.mjs`
  - 11/11 tests passed
  - 确认关键路由仍保持 server entrypoint，Ask AI 不再 client-side fetch `/api/config`，并且 app/login/register 等入口通过统一 helper 解析 session
- `pnpm test:e2e -- performance-governance.spec.ts`
  - 3/3 tests passed
  - 确认 `/`、`/notes`、`/ask` 不会在 `AUTH_BYPASS` 下掉回 `/login`
  - 确认 Notes 页面可以新建笔记并进入编辑器
  - 确认搜索弹层可以按需打开
- `pnpm build`
  - passed
  - Next.js production build、TypeScript、page data collection 和 static generation 全部完成
- `pnpm lint`
  - passed with 4 pre-existing warnings and 0 errors
  - warnings:
    - `e2e/editor.spec.ts` unused `uid`
    - `src/components/editor/excalidraw-block.tsx` uses `<img>`
    - `src/components/editor/image-row-block.tsx` uses `<img>`
    - `src/components/editor/slash-command.tsx` unused `variant`
- `pnpm test:e2e -- phase1.spec.ts phase2.spec.ts phase4.spec.ts share-links.spec.ts`
  - intentionally not used as the final gate
  - 运行时确认旧 phase suites 目前存在与当前 UI 文案 / 结构不一致的历史漂移，失败点集中在中文旧文案、旧标题断言和过时交互选择器，不属于本次页面性能治理引入的问题

## Remaining risks / follow-ups

- 当前只完成了 `页面性能治理` 的第一轮，核心是减少首屏负担和修复 server/client 边界，并没有做真实用户级的性能指标采集；下一步建议补：
  - route-level timing / web vitals 采样
  - editor mount cost profiling
  - Ask AI 首次可交互时间监控
- 旧的 `phase1 / phase2 / phase4 / share-links` Playwright 套件仍然与现有 UI 有漂移，需要单独清理和重写断言，否则会持续给后续任务制造噪音。
- `pnpm lint` 仍有 4 个既有 warning，本次没有顺手处理，因为不属于页面性能治理的直接范围。
