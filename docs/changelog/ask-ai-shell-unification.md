# 2026-03-22 - Ask AI Shell Unification

Task / goal:
- 继续统一 Ask AI 模块所在的共享外壳，让页面主体、全局布局、侧边栏与搜索入口使用更一致的 Notion 风格视觉语言，而不是只有 Ask AI 页面单独变简洁。

Key changes:
- 更新 `src/app/globals.css`：
  - 将全局背景和前景色调整为更偏 Notion 的暖白 / 深灰色系。
  - body 默认字体从 Arial 切换为 Geist 字体变量，减少“单页改了、全站没改”的割裂感。
  - 增加统一的全局选区颜色。
- 更新 `src/app/layout.tsx`：
  - 主内容区改为更柔和的径向背景与更克制的内边距，减少和新版 Ask AI 画布之间的视觉断层。
  - 共享 layout 统一使用暖色背景变量和 stone 色系暗色模式。
- 重写 `src/components/layout/sidebar.tsx`：
  - 侧边栏头部改成更轻的 workspace 卡片。
  - 导航项改为更接近 Notion 的浅底高亮、圆角和低对比 hover。
  - 新增可点击的搜索入口与键盘提示。
  - 保留并重新风格化深浅色模式切换。
- 更新 `src/components/search-dialog.tsx`：
  - 增加 `second-brain:open-search` 自定义事件支持，让侧边栏搜索按钮可以直接打开现有搜索弹窗。
  - 搜索弹窗同步改成 stone 色系和更柔和的边框 / 阴影风格。
- 更新 `e2e/v1-core-paths.spec.ts`：
  - 新增“侧边栏搜索按钮可以打开搜索弹窗”的回归用例，验证新的 shell 行为不是纯视觉占位。

Files touched:
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/search-dialog.tsx`
- `e2e/v1-core-paths.spec.ts`
- `docs/changelog/ask-ai-shell-unification.md`

Verification commands and results:
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm lint` -> ✅ 通过。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm build` -> ✅ 通过，Next.js 16.2.1 生产构建完成。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright test e2e/phase4.spec.ts e2e/v1-core-paths.spec.ts --reporter=line` -> ✅ `18 passed`。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3000/ask /tmp/ask-ai-shell-unified.png` -> ✅ 生成本地截图，人工检查了 Ask AI 页面和侧边栏的统一效果。

Remaining risks / follow-up:
- 当前统一主要覆盖了 Ask AI 所在 shell；首页、笔记、收藏等具体业务页面内部卡片和表单样式仍然保留各自历史风格，后续如果想继续收敛，需要按页面逐步统一。
- 搜索弹窗已经能从侧边栏打开，但搜索按钮本身还没有显示最近搜索或空状态推荐；如果要进一步贴近 Notion，可以继续做搜索入口的上下文感知。
