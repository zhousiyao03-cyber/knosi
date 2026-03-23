# 2026-03-23 - Token Usage Local Workspace Sources

Task / goal:
- 让 Token Usage 模块直接读取当前工作区里的 Codex 和 Claude Code 本地 usage，而不是只支持手动录入。

Key changes:
- 新增 `src/server/token-usage-local.ts`，按“当前工作区”聚合两类本地数据源：
  - Codex：读取 `~/.codex/state*.sqlite` 中 `threads.tokens_used`，按当前工作区 `cwd` 过滤。
  - Claude Code：读取 `~/.claude/projects/<当前工作区>/*.jsonl`，按 session 聚合 `input_tokens / output_tokens / cache_*`。
- 扩展 `src/lib/token-usage.ts`，新增统一的 entry source 类型、本地来源状态类型，以及 source label / persisted source 判断工具。
- 更新 `src/server/routers/token-usage.ts`：
  - `list` 现在返回“数据库记录 + 当前工作区本地 session”的合并结果。
  - `overview` 现在返回聚合统计外，还会附带本地来源状态，供 Dashboard 展示。
- 更新 `src/app/usage/page.tsx`：
  - 顶部新增本地来源状态卡片和“刷新本地用量”按钮。
  - 列表中为每条记录标注来源，且本地实时数据不可删除。
  - 空态和说明文案改为强调“当前工作区自动读取 + 手动补录并存”。
- 更新 `src/app/page.tsx` 和 `README.md`：
  - Dashboard 增加本地来源状态提示。
  - README 明确说明自动读取的范围与路径。
- 更新 `e2e/v1-core-paths.spec.ts`，把 Token Usage 的断言改成兼容“页面存在本地自动用量”的版本，避免依赖固定总 token 数。

Files touched:
- `src/lib/token-usage.ts`
- `src/server/token-usage-local.ts`
- `src/server/routers/token-usage.ts`
- `src/app/usage/page.tsx`
- `src/app/page.tsx`
- `e2e/v1-core-paths.spec.ts`
- `README.md`
- `docs/changelog/token-usage-local-sources.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有既存 `next.config.ts -> src/server/db/path.ts` 的 NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; pnpm db:push` -> ✅ 将 `token_usage_entries` 表应用到当前默认开发库。
- `sqlite3 data/second-brain.db ".schema token_usage_entries"` -> ✅ 确认默认库已有 `token_usage_entries` 表。
- `curl -sS 'http://127.0.0.1:3000/api/trpc/tokenUsage.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D%7D'` -> ✅ 返回当前工作区本地 session：Codex `15` 条、Claude Code `9` 条，并带有 `localSources` 状态。
- `curl -sS 'http://127.0.0.1:3000/api/trpc/tokenUsage.overview?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D%7D'` -> ✅ 返回合并聚合统计，当前工作区总计 `236,358,595` tokens，provider 为 Codex + Claude Code。
- `source ~/.zshrc >/dev/null 2>&1; pnpm exec playwright test e2e/v1-core-paths.spec.ts --grep 'Token Usage' --reporter=line` -> ⚠️ 未完成；当前已有用户自己的 `next dev` 进程占用同仓库，Playwright 配置又要求单独起一个隔离 dev server，Next 因“同目录已有 dev server”而拒绝启动。已改用真实 tRPC HTTP 请求和页面 HTML 响应完成功能验证。

Remaining risks / follow-up:
- 当前自动读取范围是“当前工作区”，不是全局所有仓库的总用量；这样 Dashboard 更聚焦，但如果你之后想看全局账单，还需要再加一个跨工作区视图。
- Codex 本地状态库目前只暴露 `tokens_used` 总量，拿不到 input / output / cached breakdown，所以 Codex 自动记录里这些字段会显示为 `0`。
- Claude Code 的 `cachedTokens` 当前是 `cache_creation_input_tokens + cache_read_input_tokens` 的聚合值，适合趋势观察，但不一定完全等价于 Anthropic 控制台里的账单口径。
