# Ask AI daemon auth middleware fix — 2026-04-09

## 问题
生产环境 `/ask` 始终显示橙色横幅 "本地 Claude daemon 未运行"，即使本机 `pnpm usage:daemon` 已在运行并指向线上。每次提问 2 分钟后超时报错。

## 根因
`src/proxy.ts` 的 auth middleware 白名单里有 `/api/analysis`（源码分析 daemon 走通的原因），但 2026-04-09 新加的 chat daemon 端点全部没加，本机 daemon 无浏览器 cookie，所有请求被 307 重定向到 `/login`：

- `/api/daemon/ping` — 心跳写不进 → `daemon_heartbeats` 表永远空 → 前端横幅 "最后心跳：从未"
- `/api/chat/claim` / `/progress` / `/complete` — daemon 永远认领不到任务 → 所有 chat_tasks 永远 queued → 前端 2 分钟超时

通过 `curl -X POST https://second-brain-self-alpha.vercel.app/api/daemon/ping` 直接拿到 `HTTP 307 → Redirecting...` 确认。

## 修复
`src/proxy.ts` 白名单追加：

- `pathname.startsWith("/api/daemon/")` — ping + status
- `pathname === "/api/chat/claim"` / `progress` / `complete` — chat 任务生命周期
- `pathname.startsWith("/api/cron/")` — Vercel Cron 匿名调用（顺带修，原本也该是公开的）

**没有**把整个 `/api/chat` 前缀放行，`POST /api/chat` 仍然需要登录（这是主入口，必须鉴权）。

## 安全说明
`chat/{claim,progress,complete}` 匿名可访问意味着任何人都能读/写队列。这是 v1 原本就接受的信任模型，与 `/api/analysis/*` 对称。要加固需要 shared secret header，不属于本次修复范围。

## 文件
- `src/proxy.ts`

## 验证
- `pnpm build` ✅ 通过
- Commit `4f73a7b` push 到 main，Vercel 自动部署
- 部署完成后，本机 daemon（无需重启）自动恢复心跳
- 线上 `/ask` 橙色横幅消失，Ask AI 提问得到正常流式回答 ✅ 用户确认

## 剩余风险
无。预先存在的 lint warnings 与本次改动无关。
