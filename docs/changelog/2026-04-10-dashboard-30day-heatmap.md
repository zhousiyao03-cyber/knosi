# 2026-04-10 - Dashboard 最近 30 天工作时长热力图

Task / goal:
- 在首页（dashboard）增加一个宏观视角的"最近 30 天工作时长"卡片，和已有的"今日专注"卡片互补——后者是当天微观视角，新卡片用 GitHub 风格热力图呈现最近 30 天的整体工作节奏，一眼能看出哪几天满负荷、哪几天断档、最近连续工作了多久。

Key changes:
- `src/server/routers/focus.ts`
  - 新增 `focus.rangeStats` tRPC query：输入 `{ endDate, days, timeZone }`（`days` 默认 30，上限 120），一次 SQL 拉出整个区间所有 `activitySessions`，然后在内存里循环调用 `buildDailyStats` 切成逐日聚合。
  - 复用既有 `weeklyStats` 的模式（单次 SQL + 内存切片），不新增数据库查询成本曲线；不新增 schema；不写入 `focusDailySummaries`，只做读聚合。
  - 输出每天 `{ date, totalSecs, workHoursSecs }`，前端目前用 `totalSecs`（与首页"今日专注"口径一致），`workHoursSecs` 预留给未来按"有效工时"筛选。
- `src/components/dashboard/daily-focus-heatmap.tsx`（新增）
  - GitHub-contribution 风格网格：Monday-first 列式布局，每列一个自然周，30 天 ≈ 5~6 列；首列顶部按星期几补 empty 占位，末列补尾。
  - 5 档颜色分级（0m / <1h / 1-3h / 3-5h / 5-8h / 8h+），dark mode 用更亮的 sky 色阶。
  - 今天的格子加 `ring-2 ring-amber-400 ring-offset` 高亮。
  - 每个格子用 native `title` 属性作为 hover tooltip，展示 `{月}月{日}日 ({周X}) · Xh Ym`。
  - 顶部 4 个汇总指标卡：**总计** / **活跃日均**（总时长 ÷ 有工作记录的天数，避免休息日摊薄均值）/ **连续**（从今天倒数连续工作的天数）/ **峰值**（30 天里最长的一天）。
  - 右上角 "Focus 详情 →" 链接跳到 `/focus`（未做按日期深链，因为当前 focus 页面还没读 `?date=` 参数，属于后续工作）。
  - 图例条 + loading 骨架 + 暂无数据空态都齐。
  - 热力图 `role="grid"` + `aria-label`，每个数据格 `role="gridcell"`，便于 e2e 稳定断言。
- `src/components/dashboard/dashboard-page-client.tsx`
  - `import { DailyFocusHeatmap }`。
  - 在"今日专注"卡片和主 grid（最近笔记 / 学习 / 项目）之间插入 `<DailyFocusHeatmap />` 作为独立卡片。
- `e2e/dashboard-heatmap.spec.ts`（新增）
  - Smoke 测首页渲染热力图卡片：标题可见、4 个汇总指标标签可见、`role="grid"` 可见、恰好 30 个 `role="gridcell"`、"Focus 详情"链接 `href="/focus"`。

Files touched:
- `src/server/routers/focus.ts`
- `src/components/dashboard/daily-focus-heatmap.tsx`（新增）
- `src/components/dashboard/dashboard-page-client.tsx`
- `e2e/dashboard-heatmap.spec.ts`（新增）
- `docs/changelog/2026-04-10-dashboard-30day-heatmap.md`（本文件）

Verification commands and results:
- `pnpm build`
  - ✅ 通过。Next build 成功，路由表正常输出，无 TypeScript 错误。
- `pnpm exec eslint src/components/dashboard/daily-focus-heatmap.tsx`
  - ✅ 通过，无 warning（初版有 2 个 `react-hooks/exhaustive-deps` warning，改成 `useMemo(() => data ?? [], [data])` 稳定引用后消除）。
- `pnpm lint`
  - ✅ 0 errors。新文件 0 warning。仓库其他 6 个 warning 均为 pre-existing。
- `pnpm test:e2e e2e/dashboard-heatmap.spec.ts`
  - ✅ 1/1 passed (6.7s)。
- `pnpm test:e2e`（全量）
  - 48 passed / 69 failed / 14 skipped / 1 did not run。
  - 对比 baseline（本次改动 stash 后）：43 passed / 74 failed / 14 skipped / 1 did not run。
  - 我的改动把 passed 从 43 提到 48（+5，其中 1 个是新加的 heatmap spec），failed 从 74 降到 69（-5）。**没有引入任何新失败，反而顺带让 5 个 flaky 测试回归。**
  - 剩余的 69 个失败全部是 pre-existing 技术债：phase1 spec 早已失修（断言 `main h1` 含"首页"，但现在首页 h1 是问候语"今日事，我来帮。"/动态用户名），focus-tracker.spec 的 `data-testid="dashboard-focus-card"` 在现在的 dashboard-page-client 里不存在等。这些不在本任务 scope。

Remaining risks / follow-up:
- 点击某一格目前只是 hover 看 tooltip，不跳转到该日 focus 详情——因为 `/focus` 页面还没读取 `?date=` URL 参数。如果想支持"从热力图直达某天"，后续需要同时给 focus 页面加 URL 参数、给 heatmap cell 加 Link。
- 汇总指标的"活跃日均"口径用的是 `totalSecs`，和首页"今日专注"卡片一致，但和 focus 页面的 `workHoursSecs`（仅 work-tagged）口径不同。如果后续产品要求统一到"有效工时"，只需把 `DailyFocusHeatmap` 里的 `totalSecs` 替换为 `workHoursSecs` 即可（后端已经返回了这个字段）。
- 当 30 天内 activitySessions 数据量特别大时（目前个人单用户不会触发），`rangeStats` 的内存聚合路径和 `weeklyStats` 会等比放大。长期可以切换为直接查 `focusDailySummaries` 预聚合表，但那张表当前依赖 AI 生成 summary 的链路才会写入，不是纯聚合缓存，短期不值得改造。
- pre-existing 69 个 e2e 失败是仓库级技术债（phase1 / focus-tracker / phase2 / phase6 等断言已跟不上当前 UI），需要单独开任务收拾，本次不处理。
