# 2026-03-22 - Ask AI Notion-style UI Refresh

Task / goal:
- 参考 Notion AI 更简洁、单焦点的界面风格，重做 `Ask AI` 模块的视觉层级与页面编排，同时保留来源切换、保存为笔记、切换思路重答等已有能力。

Key changes:
- 将 `src/app/ask/page.tsx` 从原来的“双栏工作台”重构为更接近 Notion AI 的单画布布局：
  - 顶部改成轻量 breadcrumb 风格的会话头部。
  - 空状态改成大留白 hero + 居中输入卡片 + 快捷入口卡片。
  - 对话状态下保留底部大输入框，但把来源与后续动作收拢到最新一条回答下方，减少页面噪音。
- 输入区改为更接近 Notion AI 的大圆角输入容器：
  - 来源范围切换改成轻量 pill。
  - placeholder 更新为 `使用 AI 处理各种任务...`。
  - 空状态与对话状态使用不同的吸底策略，避免首屏标题和输入区互相抢视觉焦点。
- 调整 Ask AI 回归测试：
  - 更新空状态、快捷入口和输入框 placeholder 断言。
  - 将 `/api/chat` 的存在性检查改为稳定的 `GET -> 405` 断言，避免真实流式 AI 响应导致 Playwright 偶发超时。

Files touched:
- `src/app/ask/page.tsx`
- `e2e/phase4.spec.ts`
- `e2e/v1-core-paths.spec.ts`
- `docs/changelog/ask-ai-notion-ui-refresh.md`

Verification commands and results:
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm lint` -> ✅ 通过。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm build` -> ✅ 通过，Next.js 16.2.1 生产构建完成。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright test e2e/phase4.spec.ts e2e/v1-core-paths.spec.ts --reporter=line` -> ✅ `17 passed`。
- `PATH=/usr/local/bin:$PATH; /usr/local/bin/pnpm exec playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3000/ask /tmp/ask-ai-redesign.png` -> ✅ 生成本地截图，人工检查了空状态首页的整体层级与留白。

Remaining risks / follow-up:
- 当前 Ask AI 模块只重做了页面主体，左侧全局侧边栏仍然沿用项目现有布局风格；如果后续想更像 Notion，需要把页面级改造扩展到整体 shell。
- 首屏标题、输入卡片和快捷入口的纵向节奏已经收紧，但如果后续要继续追 Notion 的质感，可以再统一全局字体、边框对比度和侧边栏密度。
