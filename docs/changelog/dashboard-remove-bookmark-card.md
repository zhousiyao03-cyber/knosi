# 2026-03-23 - Dashboard Remove Bookmark Entry

Task / goal:
- 从首页移除“收藏”相关入口和区块，让 Dashboard 继续往当前高频主路径收口。

Key changes:
- 更新 `src/app/page.tsx`，删除首页的“收藏”统计卡和“最近收藏”区块，并把首页布局从 4 卡 / 3 列收紧为 3 卡 / 2 列内容区。
- 更新 `src/server/routers/dashboard.ts`，移除首页不再消费的 `bookmarkCount` 和 `recentBookmarks` 查询，减少无效读取。
- 更新 `e2e/phase6.spec.ts`，去掉首页必须展示“收藏”卡片和“最近收藏”区块的断言。

Files touched:
- `src/app/page.tsx`
- `src/server/routers/dashboard.ts`
- `e2e/phase6.spec.ts`
- `docs/changelog/dashboard-remove-bookmark-card.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有仓库既存的 `next.config.ts -> src/server/db/path.ts` NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; node --input-type=module <<'EOF' ... EOF` -> ✅ 通过；使用 Playwright Chromium 直连现有 `http://127.0.0.1:3000/`，确认首页 `main` 中仍显示 `本月 Token`，且不再出现 `收藏` 卡片或 `最近收藏` 区块。

Remaining risks / follow-up:
- 当前只是把首页上的收藏入口拿掉，收藏模块本身和侧边栏入口仍然保留；如果你之后想进一步收口，也可以继续评估是否把侧边栏里的收藏入口一并隐藏。
