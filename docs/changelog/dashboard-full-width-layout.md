# 2026-03-28 - Dashboard Full Width Layout

Task / goal:
- 调整首页 Dashboard 的桌面端布局，让内容真正铺满主内容区，不再出现左侧堆叠、右侧空白明显的问题。

Key changes:
- 重写 `src/app/(app)/page.tsx` 的首页布局，改成更稳定的桌面端 12 栏结构。
- 顶部摘要区改成完整的 hero + 卡片排布，让首屏横向占满主栏。
- 把“最近笔记”提升为整宽主面板，桌面端不再出现左侧一列内容、右侧留白明显的状态。
- 按需求移除首页中的 Token Usage 展示，线上首页只保留更聚焦的内容工作流入口。
- 给首页主内容栅格和最近笔记面板补充测试定位点，便于后续验证布局结构。

Files touched:
- `src/app/(app)/page.tsx`
- `e2e/phase6.spec.ts`
- `docs/changelog/dashboard-full-width-layout.md`

Verification commands and results:
- `pnpm lint` -> ✅ 通过。
- `pnpm build` -> ✅ 通过，Next.js 16 生产构建成功。

Remaining risks / follow-up:
- 这次调整主要针对桌面端横向利用率；如果后续还想继续强化首页存在感，可以再考虑增加欢迎语、快捷入口或最近 Ask AI 会话摘要。
