# 2026-03-31 Focus Cumulative App Time And Journal Weekday Titles

## date

- 2026-03-31

## task / goal

- 把 `/focus` 和 dashboard 的 focus 统计口径收敛成“当天每个 App 的累计时长”，减少 `focused/span` 推导时间带来的偏差。
- 把今日日报标题改成“日期 + 星期几”，并把现有自动日报标题一并回填成同样格式。

## key changes

- 调整 focus Web 展示逻辑：
  - `buildTopApps(...)` 改为始终按原始 `durationSecs` 聚合。
  - `splitSessionsByDisplayThreshold(...)` 改为始终按原始 `durationSecs` 决定可见和折叠。
  - `/focus` 页面改为消费 `focus.dailySessions`，`Top apps` 显示当天原始 session 的累计 app 时长，主列表改成更直白的 `Activity blocks`。
  - dashboard focus card 改为显示 `Tracked today`，并按原始累计时长展示 timeline 和 top apps。
  - 更新 focus E2E，用独立 app 名称和串行执行避免跨用例数据串扰。
- 调整日报标题与回填逻辑：
  - `formatJournalTitle(...)` 现在输出 `2026年3月31日 星期二` 这种格式。
  - 新增自动日报标题解析 / 规范化 helper，兼容旧标题 `2026年3月31日`。
  - 新增服务端 journal title normalization helper，在 `notes.list`、`notes.get`、`notes.openTodayJournal` 和 `dashboard.stats` 中自动把旧自动日报标题升级到带星期几的格式。
  - 更新日报 E2E 到当前英文 UI 文案，并校验新标题格式。
- 更新 README，记录新的 focus 统计口径和日报标题格式。

## files touched

- `src/components/focus/focus-top-apps.ts`
- `src/components/focus/focus-display.ts`
- `src/components/focus/focus-page-client.tsx`
- `src/app/(app)/page.tsx`
- `src/components/focus/focus-top-apps.test.mjs`
- `src/components/focus/focus-display.test.mjs`
- `src/lib/note-templates.ts`
- `src/lib/note-templates.test.mjs`
- `src/server/notes/journal-titles.ts`
- `src/server/routers/notes.ts`
- `src/server/routers/dashboard.ts`
- `e2e/focus-tracker.spec.ts`
- `e2e/phase2.spec.ts`
- `README.md`
- `docs/superpowers/plans/2026-03-31-focus-cumulative-app-time.md`
- `docs/changelog/2026-03-31-focus-cumulative-app-time-and-journal-weekday-titles.md`

## verification commands and results

- `node --test --experimental-strip-types src/components/focus/focus-top-apps.test.mjs src/components/focus/focus-display.test.mjs src/lib/note-templates.test.mjs`
  - ✅ 8 passed
- `pnpm exec eslint src/components/focus/focus-page-client.tsx src/app/'(app)'/page.tsx src/components/focus/focus-top-apps.ts src/components/focus/focus-display.ts src/lib/note-templates.ts src/lib/note-templates.test.mjs src/server/notes/journal-titles.ts src/server/routers/notes.ts src/server/routers/dashboard.ts e2e/focus-tracker.spec.ts e2e/phase2.spec.ts`
  - ✅ passed
- `pnpm exec playwright test e2e/focus-tracker.spec.ts --workers=1`
  - ✅ 2 passed
- `pnpm exec playwright test e2e/phase2.spec.ts -g "打开今日日报会带入当天标题和日报模板" --workers=1`
  - ✅ 1 passed
- `node --input-type=module <<'EOF' ... EOF`
  - ✅ 本地 `data/second-brain.db` 里的 `2` 篇自动日报标题已回填为带星期几的格式
- `sqlite3 -json data/second-brain.db "select title from notes where type = 'journal';"`
  - ✅ 当前本地日报标题示例为 `2026年3月27日 星期五`、`2026年3月28日 星期六`

## remaining risks or follow-up items

- `/focus` 现在优先追求“和原始记录对得上”的累计时长，可读性更强，但语义合并出来的 block 解释力被弱化了；如果后续要恢复高层语义视图，最好和累计时长分开展示。
- 自动回填只会改“系统生成的日期型日报标题”；用户手改过的自定义日报标题不会被覆盖。
