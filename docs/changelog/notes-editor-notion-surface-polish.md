## 2026-03-23

### Task / Goal

继续把笔记编辑页的表层交互往 Notion 靠：收紧左侧插入面板尺寸与信息层级，同时把头图重做成通栏大封面，并把封面来源改成内置背景图库而不是本地上传。

### Key Changes

- 将左侧插入面板改成接近 Notion 的紧凑卡片：
  - 固定壳子为 `324 × 385`
  - 顶部保留 `建议` 区
  - 中间按 `基本区块 / 高级区块 / 媒体` 分区
  - 底部补 `关闭菜单 / esc`
  - 为常用块补充轻量 shortcut hint
- 重做笔记页头图：
  - 取消原来居中的圆角 header 卡片
  - 在笔记页内局部抵掉 `main` 容器 padding，让头图变成更接近 Notion 的 full-bleed 视觉
  - 头图高度固定为 `280px`
  - 无封面时只在 title 上方提供轻量 `添加封面` 入口
  - 有封面时 hover 显示 `更改封面 / 移除封面`
- 封面来源从“本地上传图片”切换为“内置背景图库”：
  - 新增 5 张本地 SVG 背景图
  - 通过封面选择面板写入预设 cover id
  - 保留对旧 cover 数据的兼容，历史 data URL / 远程图片仍可继续渲染
- 更新 e2e：
  - 覆盖插入面板的分区结构
  - 覆盖从内置背景图库选择封面、封面高度为 `280px`、移除封面的完整流程

### Files Touched

- `README.md`
- `docs/changelog/notes-editor-notion-surface-polish.md`
- `e2e/phase2.spec.ts`
- `public/covers/amber-window.svg`
- `public/covers/graphite-paper.svg`
- `public/covers/plum-stage.svg`
- `public/covers/sage-garden.svg`
- `public/covers/sky-tide.svg`
- `src/app/notes/[id]/page.tsx`
- `src/components/editor/editor-commands.ts`
- `src/components/editor/slash-command.tsx`
- `src/components/editor/tiptap-editor.tsx`
- `src/lib/note-appearance.ts`

### Verification Commands And Results

- `node .../pnpm.cjs exec playwright test e2e/phase2.spec.ts --grep '从正文移到左侧悬浮区时不会丢失 hover|插入菜单采用 Notion 风格分区结构|页面头部支持从内置背景图库选择和移除封面' --config=playwright.insert.config.ts`
  - 通过，`3 passed (6.0s)`
- `node .../pnpm.cjs lint`
  - 通过
- `node .../pnpm.cjs build`
  - 通过；保留 1 条已有的 Turbopack NFT tracing warning
- 隔离副本 `http://127.0.0.1:3310/notes` 人工截图检查
  - 插入面板 bounding box 为 `324 × 385`
  - 通栏头图 bounding box 为 `1344 × 280`（1600 宽视口下）

### Remaining Risks / Follow-up

- 当前封面仍然没有 `调整位置 / reposition` 能力，只支持预设切换与移除。
- 这一轮按你的要求去掉了封面上传入口；如果后续想同时保留“内置图库 + 用户上传”，需要再补一个二级来源选择。
- 构建阶段仍有一条既存的 Turbopack NFT tracing warning，和这次 UI 改动无直接冲突。
