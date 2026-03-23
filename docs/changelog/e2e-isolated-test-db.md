# 2026-03-23 E2E 独立测试库

## task / goal

- 让 Playwright E2E 使用独立 SQLite 测试库，避免测试数据混入日常开发库。

## key changes

- 新增 `src/server/db/path.ts`，统一解析 SQLite 路径，支持通过 `SQLITE_DB_PATH` 覆盖默认数据库。
- 更新 `src/server/db/index.ts` 和 `drizzle.config.ts`，让运行时数据库与 Drizzle CLI 都能切换到指定库。
- 新增 `e2e/global-setup.ts` 和 `e2e/test-db.ts`，在 Playwright 启动前清空并重建专用测试库。
- 更新 `playwright.config.ts`，改用固定测试端口 `3100`，显式注入测试库路径，并关闭本地 `reuseExistingServer`，避免误连手动启动的开发服务。
- 更新 `.gitignore`，忽略 `data/` 下递归生成的测试库文件。
- 更新 `README.md`，说明 `pnpm test:e2e` 默认使用独立测试库。
- 更新 `package.json`，让 `pnpm lint` 先确保 `test-results/` 目录存在，避免与 Playwright 目录初始化时产生校验冲突。

## files touched

- `src/server/db/path.ts`
- `src/server/db/index.ts`
- `drizzle.config.ts`
- `e2e/test-db.ts`
- `e2e/global-setup.ts`
- `playwright.config.ts`
- `.gitignore`
- `README.md`
- `package.json`
- `docs/changelog/e2e-isolated-test-db.md`

## verification commands and results

- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS main_notes_before FROM notes;"` -> ✅ `140`
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm exec playwright test e2e/phase2.spec.ts` -> ✅ `18 passed (42.8s)`
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH /usr/local/bin/pnpm lint` -> ✅ 通过
- `sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS main_notes_after FROM notes;"` -> ✅ `140`，主库计数未变化
- `sqlite3 -header -column data/test/second-brain.e2e.db ".tables"` -> ✅ 独立测试库已建表，包含 `notes`、`bookmarks`、`todos`、`knowledge_chunks` 等业务表
- `ls -lh data/test` -> ✅ 独立测试库文件位于 `data/test/second-brain.e2e.db`，与主库分离

## remaining risks or follow-up items

- 目前 `pnpm test:e2e` 每次都会重建 `data/test/second-brain.e2e.db`；如果后续 E2E 规模继续扩大，可以再考虑按 project 拆分测试库或按 worker 隔离。
- 本机如果切换 Node 主版本，`better-sqlite3` 仍然需要像这次一样重新执行 `pnpm rebuild better-sqlite3`。
