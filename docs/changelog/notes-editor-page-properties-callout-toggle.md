# 2026-03-23 - Notes Editor Page Properties, Callout And Toggle

## Task / Goal

把笔记编辑区继续往 Notion 靠拢，优先补齐页面级身份信息、块级可发现性和高价值块类型，让编辑页更像“页面系统”而不是单纯富文本编辑器。

## Key Changes

- 重做笔记编辑页头部与页面属性区：
  - 标题上方增加更轻量的返回 / 保存状态 / 最近编辑信息
  - 支持页面 `icon` 和 `cover`
  - 将类型、标签、图标、封面改成默认可见的 properties 区，而不是藏在二级入口
- 扩展笔记数据模型与保存链路：
  - `notes` 表新增 `icon` 和 `cover` 字段
  - `notes.create` / `notes.update` 支持保存页面图标和封面
  - 笔记列表卡片同步展示自定义 icon 和更稳定的测试标识
- 为编辑器补齐 Notion 风格的新块：
  - 新增 `Callout` 节点与 tone 切换
  - 新增 `折叠列表` 节点与 summary 输入
  - Slash 命令和左侧插入菜单都可插入这两种块
- 提升块级交互的可发现性：
  - 左侧 `+ / ⋮⋮` 悬浮区改成更稳定、更可见的胶囊样式
  - hover 当前块时增加轻量高亮底
  - 块菜单不再对 `Callout` / `Toggle` 暴露不合理的“转为”操作
- 收口编辑器细节：
  - 用 `StarterKit` 内建的 `link` / `underline` 配置消除 duplicate extension warning
  - 气泡工具条去掉 block-level heading 切换，只保留 inline formatting
  - 调整图片、callout、toggle 的全局样式，整体视觉更接近 Notion
- 更新 Phase 2 E2E：
  - 覆盖默认可见的 properties 区
  - 覆盖页面 icon / cover
  - 覆盖 `Callout` 和 `折叠列表` 插入能力

## Files Touched

- `README.md`
- `docs/changelog/notes-editor-page-properties-callout-toggle.md`
- `e2e/phase2.spec.ts`
- `src/app/globals.css`
- `src/app/notes/[id]/page.tsx`
- `src/app/notes/page.tsx`
- `src/components/editor/bubble-toolbar.tsx`
- `src/components/editor/callout-block.tsx`
- `src/components/editor/editor-block-ops.ts`
- `src/components/editor/editor-commands.ts`
- `src/components/editor/tiptap-editor.tsx`
- `src/components/editor/toggle-block.tsx`
- `src/lib/note-appearance.ts`
- `src/server/db/schema.ts`
- `src/server/routers/notes.ts`

## Verification Commands And Results

- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm db:push`
  - 通过，Drizzle 输出 `Changes applied`
- `sqlite3 data/second-brain.db "PRAGMA table_info(notes);"`
  - 通过，确认 `notes` 表新增 `icon` 和 `cover` 列
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm lint`
  - 通过
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm exec playwright test e2e/phase2.spec.ts --reporter=line`
  - 通过，`21 passed (15.0s)`
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm build`
  - 通过，Next.js 16 生产构建成功
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm exec playwright screenshot --device='Desktop Chrome' --wait-for-timeout=4000 http://127.0.0.1:3000/notes/70041a3c-c6ef-44fc-a343-184fc5f8cecf /tmp/notes-editor-pass.png`
  - 通过，生成截图并人工检查了页面头部、默认可见 properties 区和整体留白节奏

## Remaining Risks / Follow-up

- 当前 `Toggle` 已经具备可编辑 summary 和折叠正文，但还没有真正的多级嵌套交互与拖拽排序，仍是 P0/P1 版本。
- 选中文本后的链接编辑仍然依赖原生 `prompt`，可用但还不够 Notion；后续可以补轻量 link popover。
- `pnpm build` 仍会输出一条已有的 Turbopack NFT tracing warning，指向 `next.config.ts -> src/server/db/path.ts` 这条链路；本次没有扩大问题，但值得后续单独收口。
