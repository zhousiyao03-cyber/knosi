# 2026-03-24 - Token Usage Seven-Day Panel

Task / goal:
- 把 Token Usage 面板里“本月”主指标改成展示最近 7 天，避免首页和完整面板的主视角不够及时。

Key changes:
- 更新 `src/app/page.tsx`：
  - 首页顶部的 Token 卡片从 `thisMonthTokens` 改成 `last7DaysTokens`。
  - Dashboard 里的 Token Usage 概览卡第二项从“本月”改成“最近7天”，辅助文案改成“本月累计 …”。
- 更新 `src/app/usage/page.tsx`：
  - 独立 Token Usage 页面顶部统计卡第二项从“本月”改成“最近7天”，辅助文案改成“本月累计 …”。

Files touched:
- `src/app/page.tsx`
- `src/app/usage/page.tsx`
- `docs/changelog/token-usage-seven-day-panel.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有既存 `next.config.ts -> src/server/db/path.ts` 的 NFT tracing warning，但构建成功。

Remaining risks / follow-up:
- 这次只调整了面板主指标的展示口径，没有改底层聚合逻辑；`thisMonthTokens` 仍保留在 summary 里作为辅助信息。
- 这次没有补跑页面级 E2E；当前本机仍存在同目录 `next dev` 进程，Playwright 的隔离 dev server 会被 Next 16 拒绝启动。如需页面级回归，建议先停掉现有 `3000` 端口进程再跑。
