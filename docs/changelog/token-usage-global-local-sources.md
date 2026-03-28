# 2026-03-24 - Token Usage Global Local Sources

Task / goal:
- 修复本地 token usage 只统计 `second-brain` 当前仓库的问题，把 Codex / Claude Code 的本地来源切到本机全局口径。

Key changes:
- 更新 `src/server/token-usage-local.ts`：
  - Codex 不再按 `cwd` 过滤当前仓库，改为读取本机 `~/.codex/state*.sqlite` 里的全部有用量 thread。
  - Claude Code 不再只扫 `~/.claude/projects/<当前工作区>/`，改为递归聚合 `~/.claude/projects/` 下所有项目的 session 与 subagent session。
  - 新增一个 10 秒的轻量内存缓存，避免 `/usage` 和 Dashboard 轮询时重复全盘扫描本地 session。
  - 调整 notes / detail 文案，让全局来源在 UI 里更容易理解。
- 更新 `src/app/usage/page.tsx` 和 `src/app/page.tsx`：
  - 页面说明从“当前工作区”改为“本机 / 全局口径”，避免展示口径和实际数据不一致。
- 更新 `README.md`：
  - 将 Token Usage 的说明改成“本机跨工作区聚合”。
  - `/usage` 章节同步改为 Codex / Claude Code 全局本地来源。

Files touched:
- `src/server/token-usage-local.ts`
- `src/app/usage/page.tsx`
- `src/app/page.tsx`
- `README.md`
- `docs/changelog/token-usage-global-local-sources.md`

Verification commands and results:
- `source ~/.zshrc >/dev/null 2>&1; pnpm lint` -> ✅ 通过。
- `source ~/.zshrc >/dev/null 2>&1; pnpm build` -> ✅ 通过；仍有既存 `next.config.ts -> src/server/db/path.ts` 的 NFT tracing warning，但构建成功。
- `source ~/.zshrc >/dev/null 2>&1; node - <<'NODE' ... NODE` -> ✅ 直接验证本机 Claude Code 全局目录：当前共有 `218` 个带 usage 的 session 文件，总量 `514,975,904` tokens。
- `source ~/.zshrc >/dev/null 2>&1; pnpm start --port 3200` + `source ~/.zshrc >/dev/null 2>&1; node - <<'NODE' ... tokenUsage.list ... NODE` -> ✅ 应用真实返回 `Codex entryCount = 52`、`Claude Code entryCount = 218`，且 `Claude Code` detail 为“已聚合本机的 218 个 Claude Code session（含 subagents）”；同时确认返回里存在不属于 `/Users/bytedance/second-brain` 的 Claude workspace 记录。
- `source ~/.zshrc >/dev/null 2>&1; node - <<'NODE' ... tokenUsage.overview ... NODE`（基于 `pnpm start --port 3200`） -> ✅ 应用真实返回 `claude-code totalTokens = 514,975,904`、`claude-code entryCount = 218`。
- `source ~/.zshrc >/dev/null 2>&1; pnpm exec playwright test e2e/v1-core-paths.spec.ts --grep 'Token Usage' --reporter=line` -> ⚠️ 未完成；当前仓库已有用户自己的 `next dev` 进程占用 `http://localhost:3000`，Next 16 拒绝 Playwright 再起第二个同目录 dev server，报错为 “Another next dev server is already running.”。已改用 `pnpm start --port 3200` + 真实 tRPC HTTP 请求验证。

Remaining risks / follow-up:
- 全局口径比“当前仓库”会扫描更多本地文件；这次已经加了 10 秒缓存来降低轮询成本，但如果你后面本地 session 数继续增长，可能还需要进一步做增量索引或持久化缓存。
- 现在 Dashboard 和 `/usage` 都是“本机总账单”视角；如果你后面还想看 `second-brain` 单仓库视角，建议补一个可切换的范围筛选器，而不是再回到硬编码。
