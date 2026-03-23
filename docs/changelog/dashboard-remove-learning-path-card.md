# 2026-03-23 - Dashboard Remove Learning Path Card

Task / goal:
- 从首页移除“学习路径”统计卡，让 Dashboard 只保留当前仍在使用的核心入口。

Key changes:
- 更新 `src/app/page.tsx`，删除首页的“学习路径”统计卡，并把统计卡网格从 5 列收紧为 4 列。
- 更新 `src/server/routers/dashboard.ts`，移除不再被首页消费的 `learningPaths` 计数查询。
- 更新 `e2e/phase6.spec.ts`，去掉首页必须展示“学习路径”卡片的断言，改为验证仍然存在的 `本月 Token` 卡片。

Files touched:
- `src/app/page.tsx`
- `src/server/routers/dashboard.ts`
- `e2e/phase6.spec.ts`
- `docs/changelog/dashboard-remove-learning-path-card.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有仓库既存的 `next.config.ts -> src/server/db/path.ts` NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; node --input-type=module <<'EOF' ... EOF` -> ✅ 通过；使用 Playwright Chromium 直连现有 `http://127.0.0.1:3000/`，确认首页 `main` 里仍显示 `本月 Token`，且不再出现 `学习路径` 卡片。

Remaining risks / follow-up:
- 当前只是从首页移除了“学习路径”卡片，没有删除学习模块代码；如果后续要进一步收口，可以再评估是否把 `/learn` 页面也完全隐藏或下线。
