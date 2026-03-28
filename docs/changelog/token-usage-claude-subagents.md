# 2026-03-24 - Token Usage Claude Subagents + Auto Refresh

Task / goal:
- 修复 Token Usage 里 Claude Code 用量长期不更新的问题，并让页面在打开期间能自动同步最新统计。

Key changes:
- 更新 `src/server/token-usage-local.ts`：
  - Claude Code 本地读取改为递归扫描 `~/.claude/projects/<当前工作区>/` 下的全部 `*.jsonl`，不再只看顶层文件。
  - 将 `subagents/*.jsonl` 也纳入统计，避免遗漏 Claude 新版工作流写入的子代理 session token。
  - Claude 本地记录的 ID 改为使用相对路径，避免嵌套 session 命名冲突；subagent 记录会带上更明确的 notes。
- 更新 `src/lib/token-usage.ts`、`src/app/usage/page.tsx`、`src/app/page.tsx`：
  - 新增共享的 Token Usage 自动刷新间隔配置，`/usage` 页面和 Dashboard 都会定时重新拉取本地统计。
  - `/usage` 页面的“刷新本地用量”按钮只在手动触发时显示 loading，避免后台轮询时按钮闪烁。
- 更新 `README.md`：
  - 补充 Claude Code 会读取 `subagents/*.jsonl`。
  - 记录 `/usage` 默认每 15 秒自动刷新，并说明 `NEXT_PUBLIC_TOKEN_USAGE_REFRESH_INTERVAL_MS` 可调。
- 更新 `playwright.config.ts` 和 `e2e/v1-core-paths.spec.ts`：
  - 为测试环境把自动刷新间隔降到 1 秒。
  - 新增一个“已打开的 usage 页面会自动刷新新记录”的最小 E2E 用例。

Files touched:
- `src/server/token-usage-local.ts`
- `src/lib/token-usage.ts`
- `src/app/usage/page.tsx`
- `src/app/page.tsx`
- `README.md`
- `playwright.config.ts`
- `e2e/v1-core-paths.spec.ts`
- `docs/changelog/token-usage-claude-subagents.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有既存 `next.config.ts -> src/server/db/path.ts` 的 NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; node - <<'NODE' ... NODE` -> ✅ 直接验证当前工作区 Claude 目录：仅统计顶层文件时为 `85,107,716` tokens，递归纳入 subagents 后为 `132,414,877` tokens，额外补回 `47,307,161` tokens。
- `curl -sS 'http://127.0.0.1:3200/api/trpc/tokenUsage.list?...'`（基于 `pnpm start --port 3200`） -> ✅ 返回 `localSources` 中 `Claude Code entryCount = 14`，detail 为“含 subagents”，并可见 `subagents/*.jsonl` 记录。
- `curl -sS 'http://127.0.0.1:3200/api/trpc/tokenUsage.overview?...'`（基于 `pnpm start --port 3200`） -> ✅ 返回 `claude-code totalTokens = 132,414,877`，与递归聚合验证一致。
- `source ~/.zshrc >/dev/null 2>&1; pnpm exec playwright test e2e/v1-core-paths.spec.ts --grep 'Token Usage' --reporter=line` -> ⚠️ 未完成；仓库同目录已有用户自己的 `next dev` 进程在 `http://localhost:3000` 运行，Next 16 拒绝 Playwright 再起第二个 dev server，报错为 “Another next dev server is already running.”。已改用 `pnpm start --port 3200` + 真实 tRPC HTTP 请求完成功能验证。

Remaining risks / follow-up:
- Claude Code 的本地格式后续如果再调整，仍可能需要继续扩展解析逻辑；当前实现已经覆盖顶层 session 和 `subagents/*.jsonl` 两类已存在数据。
- 自动刷新默认每 15 秒执行一次；如果你后面觉得过快或过慢，可以通过 `NEXT_PUBLIC_TOKEN_USAGE_REFRESH_INTERVAL_MS` 调整。
