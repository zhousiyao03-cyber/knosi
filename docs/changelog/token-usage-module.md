# 2026-03-23 - Token Usage Module

Task / goal:
- 新增一个 token usage 模块，用来统计 Codex、Claude Code、OpenAI API 等工具的 token 用量，并同时在 Dashboard 和独立页面里展示。

Key changes:
- 新增 `src/lib/token-usage.ts`，统一维护 provider 枚举、数字格式化和 token usage 聚合逻辑，确保独立页面和 Dashboard 的统计口径一致。
- 在 `src/server/db/schema.ts` 中新增 `token_usage_entries` 表，并新增 `src/server/routers/token-usage.ts`：
  - 支持创建、删除、列表查询和概览聚合。
  - 支持 `provider / model / total / input / output / cached / notes / usageAt` 这些字段。
- 新增 `src/app/usage/page.tsx`：
  - 提供手动录入表单。
  - 提供 provider 筛选、关键字搜索、最近记录列表和 provider breakdown。
  - 支持仅填 `totalTokens`，也支持补充 input / output / cached breakdown。
- 更新 `src/app/page.tsx` 和 `src/components/layout/sidebar.tsx`：
  - 侧边栏新增 `Token 用量` 入口。
  - Dashboard 新增本月 token 卡片和 token usage 概览区块，展示总量、本月、近 7 天和最近记录。
- 更新 `e2e/v1-core-paths.spec.ts`，补充“录入 token usage 后同步显示到 Dashboard”的最小回归测试。
- 更新 `README.md` 和 `PLAN.md`，同步功能说明、页面结构和数据库 schema 文档。

Files touched:
- `src/lib/token-usage.ts`
- `src/server/db/schema.ts`
- `src/server/routers/token-usage.ts`
- `src/server/routers/_app.ts`
- `src/app/usage/page.tsx`
- `src/app/page.tsx`
- `src/components/layout/sidebar.tsx`
- `e2e/v1-core-paths.spec.ts`
- `README.md`
- `PLAN.md`
- `docs/changelog/token-usage-module.md`

Verification commands and results:
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH pnpm lint` -> ✅ 通过。
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH pnpm build` -> ✅ 通过；Turbopack 仍提示现有 `next.config.ts -> src/server/db/path.ts` 的 NFT tracing warning，但构建成功。
- `mkdir -p data/tmp && PATH=/usr/local/bin:/opt/homebrew/bin:$PATH SQLITE_DB_PATH=data/tmp/token-usage-verify.db pnpm db:push` -> ✅ 将 schema 应用到独立临时 SQLite 库。
- `sqlite3 data/tmp/token-usage-verify.db ".schema token_usage_entries"` -> ✅ 确认 `token_usage_entries` 表已实际建出，包含 `provider / total_tokens / input_tokens / output_tokens / cached_tokens / usage_at` 等字段。
- `PATH=/usr/local/bin:/opt/homebrew/bin:$PATH pnpm exec playwright test e2e/v1-core-paths.spec.ts e2e/phase6.spec.ts --reporter=line` -> ✅ `21 passed (10.8s)`，包含新增 Token Usage 闭环和 Dashboard 回归。

Remaining risks / follow-up:
- 当前版本是“手动录入 + 聚合展示”，还没有自动从 Codex / Claude Code 本地日志导入；如果你后面想继续做，我建议下一步加 importer。
- 这次没有生成新的 Drizzle 迁移文件；原因是当前工作区里 `src/server/db/schema.ts` 已经带有未提交的其他 schema 变更，直接 `pnpm db:generate` 会把无关改动一起打进迁移。当前功能已经通过 `db:push`、SQLite 实表检查和 E2E 验证可用。
