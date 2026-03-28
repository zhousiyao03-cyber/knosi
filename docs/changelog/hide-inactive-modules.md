# 2026-03-28 - Hide Inactive Modules

Task / goal:
- 把当前还不能对外使用的 `收藏`、`Todo`、`AI 探索` 从主界面隐藏，避免用户误入未收口模块。

Key changes:
- 更新 `src/components/layout/navigation.ts`，从桌面侧边栏和移动端菜单共用导航配置中移除 `收藏`、`Todo`、`AI 探索`。
- 更新 `src/app/(app)/page.tsx`，从首页移除 `待办` 统计卡和 `今日任务` 区块，只保留仍开放模块的聚合视图。
- 更新 `src/components/search-dialog.tsx`，全局搜索只展示笔记结果，并同步收口占位文案，避免通过搜索再次进入隐藏模块。
- 新增 `src/components/layout/app-brand.tsx`，用统一品牌图标替换原先侧栏和移动端里的字母块 logo。
- 移除旧的二进制 `src/app/favicon.ico`，改为 `src/app/icon.tsx` 和 `src/app/apple-icon.tsx` 代码生成图标，让浏览器标签页与移动端图标也跟新品牌一致。
- 更新 `README.md`，把这三个模块标记为“保留代码但默认隐藏入口”。
- 更新 `e2e/phase1.spec.ts`、`e2e/phase6.spec.ts`、`e2e/v1-core-paths.spec.ts`，让回归测试匹配新的入口可见性。

Files touched:
- `src/components/layout/navigation.ts`
- `src/app/(app)/page.tsx`
- `src/components/search-dialog.tsx`
- `src/components/layout/app-brand.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/app/icon.tsx`
- `src/app/apple-icon.tsx`
- `src/app/favicon.ico`
- `README.md`
- `e2e/phase1.spec.ts`
- `e2e/phase6.spec.ts`
- `e2e/v1-core-paths.spec.ts`
- `docs/changelog/hide-inactive-modules.md`

Verification commands and results:
- `pnpm lint` -> ✅ 通过。
- `pnpm test:e2e e2e/phase1.spec.ts --grep '未开放的导航项默认隐藏|移动端菜单里也不会显示未开放的导航项|首页不显示未开放模块的入口卡片或快捷链接'` -> ✅ 3 passed。
- `pnpm test:e2e e2e/phase6.spec.ts --grep '显示仍开放模块的统计卡片|首页只显示最近笔记，不显示今日任务区块|Cmd\+K 打开搜索面板|ESC 关闭搜索面板|搜索无结果提示'` -> ✅ 5 passed。
- `pnpm test:e2e e2e/v1-core-paths.spec.ts --grep '侧边栏搜索按钮可以打开搜索弹窗|创建笔记并通过 Cmd\+K 搜索到|创建收藏后不会再从 Cmd\+K 全局搜索暴露'` -> ✅ 3 passed。
- `pnpm build` -> ✅ 通过，Next.js 16 生产构建成功。
- `pnpm build`（favicon 代码化后复跑） -> ✅ 通过，构建输出已包含 `/icon` 与 `/apple-icon` 路由。

Remaining risks / follow-up:
- 当前只是隐藏用户主入口，`/bookmarks`、`/todos`、`/explore` 路由和后端实现仍保留，已知用户若直接输入 URL 仍可进入。
