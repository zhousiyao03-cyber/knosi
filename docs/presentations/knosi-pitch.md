# Knosi：一个自部署的 AI 时代个人知识库是怎么做出来的

> 产品：https://www.knosi.xyz　仓库：github.com/zhousiyao03-cyber/knosi
> AGPL-3.0，Docker 一键自部署

这是一篇从技术实现角度写的项目介绍。Knosi 是一个面向 AI 时代的个人知识管理平台，核心差异点有三个：Notion 级别的块编辑器、针对自己笔记的 Hybrid RAG、以及一个能把 AI 调用路由到你已有 Claude Pro/Max 订阅（而不是再烧 API Key）的 daemon 架构。

下面按技术栈 → 架构 → 前端 → 后端 → RAG → MCP → 部署的顺序展开，重点讲有意思的取舍和踩过的坑。

---

## 1. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js 16 App Router + React 19 | RSC + Server Actions，一套代码同构 |
| 样式 | Tailwind CSS v4 | 新引擎，零 runtime |
| 编辑器 | Tiptap v3（ProseMirror） | block-based，生态成熟，可深度定制 |
| API | tRPC v11 + Zod v4 | 端到端类型安全，无需手写 DTO |
| ORM | Drizzle | SQL-first，类型安全，零 runtime 成本 |
| DB | libsql / Turso | SQLite 语法，生产走边缘复制 |
| Auth | Auth.js v5 | GitHub/Google OAuth + 邮密 |
| AI SDK | Vercel AI SDK v6 | provider 抽象 + 流式 |
| 存储 | S3-compatible（R2/MinIO/S3） | 图床 |
| 图表 | Mermaid + Excalidraw | 嵌入编辑器 |
| URL 抓取 | @mozilla/readability + linkedom | URL → 正文 → 摘要 |
| 搜索 | MiniSearch（BM25） | 纯 JS 零依赖，跟 RAG 共用一套 tokenizer |
| 缓存/PubSub | Redis | entitlement 缓存、daemon 唤醒通道 |
| 观测 | pino + Langfuse + OpenTelemetry | 日志 + LLM trace + metrics |
| 容器 | Docker + k3s + Traefik + Caddy | 三层反代（见第 8 节） |
| 测试 | Playwright（E2E） + Vitest（unit） | 集成测试走真 DB |
| CLI | `@knosi/cli` | daemon + skill 安装 + usage 上报 |

---

## 2. 整体架构

```
          ┌─────────────────────────────────────────────┐
          │  用户浏览器 / Claude Web / Claude Code CLI   │
          └────────────────┬────────────────────────────┘
                           │ HTTPS (TLS via Let's Encrypt)
                           ▼
    ┌─────────────────────────────────────────────────────┐
    │  Caddy (systemd on host)                            │
    │  · 终止 TLS  · www/apex/k3s 三域直接 proxy（不 301） │
    │  · 转发到 127.0.0.1:30080 的 Traefik                │
    └────────────────────┬────────────────────────────────┘
                         ▼
    ┌─────────────────────────────────────────────────────┐
    │  k3s (single-node) + Traefik Ingress                │
    │  namespace: knosi                                    │
    │  ├─ Deployment: knosi (Next.js standalone, 1 replica)│
    │  │   · envFrom Secret: knosi-env                     │
    │  │   · PVC /app/data (SQLite 本地缓存/索引)          │
    │  │   · startup/readiness/liveness probe → /login     │
    │  └─ Deployment: redis (AOF + PVC)                    │
    └────────────────────┬────────────────────────────────┘
                         ▼
    ┌─────────────────────────────────────────────────────┐
    │  Next.js App (tRPC + API routes + Server Components) │
    │   ├─ tRPC routers (12 domains, Zod 全量校验)         │
    │   ├─ AI 抽象层 (daemon / openai / local / codex)     │
    │   ├─ RAG (chunking → embed → BM25 + 向量 → RRF)      │
    │   ├─ Job queue (SQLite pull-based, CAS claim, 退避)  │
    │   └─ MCP server (/api/mcp, OAuth 2.0 Protected)      │
    └────────┬──────────────────────┬─────────────────────┘
             ▼                      ▼
   ┌──────────────────┐   ┌──────────────────────────────┐
   │  Turso (libSQL)  │   │  本地 Claude CLI (用户机器)   │
   │  生产主库        │   │  knosi daemon 拉取任务执行     │
   └──────────────────┘   └──────────────────────────────┘
```

几个核心取舍：

1. **SQLite 语法 + libSQL 协议**：dev 是文件 DB，生产是 Turso 边缘复制。代码对差异几乎无感。
2. **单体 Next.js，不拆微服务**：个人工具，单 replica + k3s Recreate 策略。要横向扩再抽独立 worker 即可。
3. **Pull-based 队列复用业务 DB**：`knowledge_index_jobs` 表就是队列，省掉一个 broker。
4. **Redis 只做辅路**：缓存 + Pub/Sub，数据丢了也能恢复。
5. **AI provider 抽象层**：Claude Daemon / OpenAI / 本地 Ollama / Codex 四种后端同一套接口。

---

## 3. 前端

### 3.1 路由结构

```
src/app/
├─ (app)/                       # 认证后的主路由组
│  ├─ dashboard/                # 首页 — 今日 Focus / 30 天热力图 / 最近笔记
│  ├─ notes/ + notes/[id]/      # 笔记列表 + 编辑器
│  ├─ learn/                    # Learning Notebook（AI 生成大纲 / 盲点分析）
│  ├─ projects/                 # OSS Project Notes
│  ├─ portfolio/                # 持仓管理 + AI 新闻聚合
│  ├─ focus/                    # 专注时间热力图 / 应用维度拆分
│  ├─ ask/                      # Ask AI 对话
│  ├─ usage/                    # Token 用量仪表盘
│  ├─ explore/ + workflows/     # AI 探索 + 可视化工作流
│  ├─ bookmarks/                # 收藏箱
│  └─ settings/                 # 设置 / billing / ops
└─ api/
   ├─ trpc/[trpc]/              # tRPC HTTP 入口
   ├─ chat/                     # Ask AI 流式 + daemon 任务 claim/complete/progress
   ├─ daemon/{ping,tasks,status}/  # CLI daemon 心跳与任务拉取
   ├─ mcp/                      # MCP JSON-RPC over HTTP
   ├─ oauth/                    # OAuth 2.0 授权服务器
   ├─ cron/                     # CRON_SECRET 保护的定时触发
   ├─ jobs/                     # JOBS_TICK_TOKEN 保护的队列 tick
   ├─ webhooks/                 # LemonSqueezy 订阅事件
   ├─ focus/                    # 桌面收集器上报入口
   └─ upload/                   # S3 预签名
```

### 3.2 编辑器

前端最复杂的部分在 `src/components/editor/tiptap-editor.tsx` 以及一堆自定义 Node。基于 Tiptap v3（ProseMirror 上层 API），所有自定义块都用 `Node.create` + `ReactNodeViewRenderer` 的组合。

自己写 Node 的块类型：

- **代码块**：语言选择器，lowlight + highlight.js
- **Mermaid 图表**：`securityLevel: "strict"`（禁止 `"loose"` 防 XSS），支持全屏查看 + 内联编辑
- **Excalidraw 画板**：完整画板嵌入编辑器，保存到块数据里
- **Callout 提示块**：info / warn / success 三色
- **Toggle 折叠块**
- **Side-by-side Image Row**：多图并排，dnd-kit 拖拽排序 + resize + 拖出分离
- **TOC 目录块 + 侧边导航**：监听 scroll 高亮当前章节
- **任务列表 / 表格**：带增删行列、对齐、合并的工具栏

值得拎出来讲的交互：

- **Slash commands** 按 basic / lists / blocks / media 分组（`editor-commands.ts`）
- **Bubble toolbar**：选中文本浮现的格式工具栏
- **混合 Markdown 粘贴**（`markdown-table-paste.ts`）：粘一段 Markdown 进来，自动识别里面的 Mermaid 代码块、表格、标题结构，直接转换成对应的 block，而不是一坨文本全塞代码块里
- **图片粘贴**：`editorProps.handlePaste` 优先识别 File，直接上传 S3 回写 URL
- **Block-level 操作**：hover 显示 grip，支持 move / copy / delete / transform（段落 ↔ 列表 ↔ callout 相互转换）
- **搜索替换面板**
- **自动保存 + 离开保护**：debounce + beforeunload
- **只读公开分享**：`/s/<token>` 路由

SSR 踩坑：Tiptap 必须设置 `immediatelyRender: false`，否则 React 19 hydration 会报错。

### 3.3 数据流

- **TanStack Query** 作 tRPC client 的缓存层
- 服务端默认用 RSC 拉首屏数据，客户端交互走 tRPC
- **SuperJSON** 让 tRPC 能透明序列化 Date / Map / Set
- **流式对话**：Ask AI 用 `@ai-sdk/react` 的 `useChat` + `TextStreamChatTransport`，服务端用 `streamText().toTextStreamResponse()`（注意不是 `toDataStreamResponse`，v6 已改名）

---

## 4. 后端

### 4.1 数据库 schema 组织

`src/server/db/schema/` 按领域拆文件（不是按层），Drizzle 配置用 glob 全量加载：

- `auth.ts` — users / accounts / credentials（Auth.js drizzle-adapter）
- `oauth.ts` — OAuth 授权服务器（clients / codes / access_tokens）
- `notes.ts` — folders / notes / note_links / bookmarks / todos
- `chat.ts` — chat 任务表 + daemon 流式 delta 表
- `knowledge.ts` — RAG 核心：knowledge_chunks / knowledge_chunk_embeddings / knowledge_index_jobs
- `workflows.ts` — 工作流定义 + 执行记录
- `learning.ts` — learning_paths / lessons / notebook topics / reviews
- `usage.ts` — token 用量：entries / records / 每日计数器
- `focus.ts` — 活动 session / 设备配对 / 每日汇总
- `portfolio.ts` — 持仓 + AI 生成的新闻摘要
- `projects.ts` — OSS 项目分析
- `ops.ts` — 心跳、CLI token
- `billing.ts` — LemonSqueezy 订阅状态

### 4.2 tRPC

每个领域一个 router，全部用 `publicProcedure` + 从 context 取 session。输入一律 `zod/v4` 校验。所有写路径放在 Drizzle 事务里，关键写点会把入队动作塞进同一个 `db.transaction`（outbox 雏形）。

### 4.3 后台队列

文件：`src/server/jobs/queue.ts` + `worker.ts`。

设计：复用 `knowledge_index_jobs` 表当队列，不引入 broker。

原子 claim 的核心 SQL：

```sql
UPDATE knowledge_index_jobs
SET status = 'running', attempts = attempts + 1
WHERE id = (
  SELECT id FROM knowledge_index_jobs
  WHERE status = 'pending' AND queued_at <= ?
  ORDER BY queued_at ASC
  LIMIT 1
)
RETURNING *
```

关键不在 SELECT + UPDATE 两步，而在 **UPDATE 的 WHERE 里守着 `status='pending'`** —— 这就是隐式 CAS。多 worker 并发抢同一行时只有一个 UPDATE 能命中。并发实验里如果去掉这个守卫，32 并发会 32/32 全部 double-claim。

其它细节：

- **重试**：指数退避 1s / 2s / 4s / 8s，`MAX_ATTEMPTS=5`，超限进 `failed` 终态（代替 DLQ）
- **回收卡死**：每次 tick 先 `reclaimStaleJobs(10)`，超过 10 分钟的 running job 重置回 pending
- **不起 setInterval**：Next.js 在 Vercel 这类 serverless 环境里 setInterval 会丢失。改为外部触发 `tick` 接口：cron / 前端心跳 / GitHub Actions 定时点一下都可以
- **索引覆盖**：`(status, queued_at)` 复合索引把原来 EXPLAIN 里的 `TEMP B-TREE FOR ORDER BY` 消掉了

### 4.4 AI provider 抽象

`src/server/ai/provider/` 下四个后端实现同一套接口（`generateText` / `streamText` / `generateStructured`）：

1. **Claude Code Daemon**（默认推荐）：任务入 DB → 用户本地 `@knosi/cli daemon` 轮询 / 订阅 → 本地 spawn `claude` CLI → 结果 SSE 回传 → 前端渲染。**用户已有的 Claude Pro/Max 订阅直接复用，零额外 API 花销**
2. **OpenAI API**：`@ai-sdk/openai`
3. **本地 OpenAI-compatible**（Ollama / LM Studio / vLLM）：走自定义 `AI_BASE_URL`
4. **Codex / OpenClaw**：读 `~/.openclaw` 授权态

Daemon 通信流是整个项目最有意思的部分：

```
服务器                                           用户本机 daemon
  │ 1. Ask AI 请求到达                              │
  │   insert chat_task (status=pending)             │
  │   Redis PUBLISH daemon:tasks:<userId> wake ────▶│ 2. 订阅 Redis 通道收到 wake
  │                                                 │   （Redis 不可用时退化成 30s 轮询）
  │ 3. POST /api/chat/claim                  ◀──────│
  │   原子 UPDATE ... WHERE status='pending'        │
  │   RETURNING task                         ──────▶│ 4. spawn 本地 claude CLI
  │                                                 │   reads Claude Pro 订阅态
  │ 5. POST /api/chat/progress (流式 delta) ◀───────│ 5. 边读边 POST chunk
  │   SSE 转发给前端                                │
  │ 6. POST /api/chat/complete               ◀──────│ 6. 结束
```

引入 Redis Pub/Sub 之后 daemon 不用再 aggressively 轮询 `claim`，**idle 时 CPU / 网络都是 0**。Redis 不可用时 fallback 到低频拉取，不会导致任务堆积。token 校验在服务器做了短 TTL 内存缓存，避免每次 claim / progress / complete 都打穿 `oauth_access_tokens` 表。

### 4.5 Billing / Entitlements

`src/server/billing/entitlements.ts`。

Pricing 设计：

- **Self-hosted：永远 Pro 无限**（AGPL 要求）
- **Hosted Free**：每日 20 次 Ask AI，50 篇笔记，100 MB 存储，3 个分享链接，不含 Portfolio/Focus/OSS/MCP
- **Hosted Pro（$9/月 或 $90/年）**：80 次/天 Ask AI，无限笔记，10 GB 存储，全模块解锁，Knosi 自费的 AI（无需用户自己的 API Key）

`deriveEntitlements` 按 3 个输入派生权限：`subscription` 状态 + `user.createdAt` + `KNOSI_BILLING_LAUNCH_DATE`：

1. **Grandfather**：创号时间早于 launch 且在 launch 后 30 天内 → Pro（给老用户的过渡期）
2. **Trial**：新注册 7 天内 → Pro（onboarding）
3. **on_trial / active** → Pro，带 `currentPeriodEnd`
4. **cancelled**：还在 period 内 → Pro（grace）
5. **past_due**：period + 7 天内 → Pro（grace），之后降级
6. **paused / expired / 其它** → Free

缓存在 Redis `billing:ent:<userId>`，TTL 60 秒。Webhook 收到订阅变更时调 `invalidateEntitlements` 立即失效。

`/api/webhooks/lemonsqueezy` 做签名校验，把状态转换落到本地 `subscriptions` 表。

### 4.6 CLI：`@knosi/cli`

`packages/cli/` 是一个独立 npm 包，对外暴露 5 个命令：

1. `knosi auth login <url>`：浏览器端 device flow 登录，access token 存本地
2. `knosi daemon`：常驻，订阅 Redis wake 通道 / claim 任务 / spawn `claude` CLI / 流回结果。并发上限 chat=3、structured=5
3. `knosi install-skill`：写 `~/.claude/skills/save-to-knosi/SKILL.md` 模板，让 Claude Code 里可以 `/save-to-knosi` 显式存对话
4. `knosi save-ai-note --json`：管道式保存（stdin 读 payload.json）
5. `knosi usage-report`：扫 `~/.claude/projects/*.jsonl` 和 `~/.codex/state*.sqlite` 聚合后 POST 到服务端

### 4.7 Focus Tracker

服务端在 `src/server/focus/`，桌面 collector 是独立仓库 `focus-tracker`（Tauri 应用）。

算法在 `aggregates.ts`，几个比较有意思的点：

- **时区感知切片**：一条 session 可能跨天，按用户时区切成当天片段再聚合
- **streak 计算**：相邻 session 间隔 ≤ 120 秒算连续
- **display session 合并**：用 10 分钟 `DISPLAY_REJOIN_GAP_SECS` + 语义 key 合并同一任务的碎片。同一 GitHub PR / repo / search query / chat 会合并成一个"展示 session"。`getSessionSemanticKey` 按 URL 结构生成：`search:<query>` / `repo:<org/repo>` / `pr:<host><path>` 等
- **工作 vs 非工作判定**：`tags.ts` 给 app + URL 打标签（social-media / entertainment / gaming），非工作单独统计不算工时
- **单次扫描范围聚合**（`buildRangeStats`）：30 天视图用一趟扫完成，每个 session 对所有 day boundaries 算 overlap

---

## 5. RAG 管线

`src/server/ai/{chunking,indexer,rag,agentic-rag,embeddings}.ts`。这部分是最核心的算法亮点，分成四步：分块、嵌入、增量索引、混合检索。

### 5.1 Chunking

笔记本身是 Tiptap JSON（ProseMirror document），分块策略：

1. 解析 JSON，按顶层 node 遍历
2. **heading 驱动 section path**：遇到 H1/H2/H3 维护一个 `sectionPath` 栈，深度 = heading level
3. **单独成块的块级元素**：`codeBlock` / `blockquote` 各自独立 chunk，不合并
4. **普通段落**：累积到 `MAX_CHUNK_CHARS=520`（最小 120），超了 flush 一个 chunk
5. **列表**：拍平成 `- item1\n- item2`
6. 每个 chunk 的输出字段：`blockType / chunkIndex / sectionPath[] / text / textHash (sha1) / tokenCount (len/4)`

Bookmark 没有结构，就按 `\n{2,}` 分段，fallback 按中文句号分。

### 5.2 Embeddings

- 默认 OpenAI `text-embedding-3-small`（1536 dims）或本地 Ollama `nomic-embed-text`（768 dims）
- 向量存 BLOB（`Float32Array.buffer`），dims 记录在表里
- **可以完全没有**：无 embedding provider 配置时只走 keyword recall，系统仍然能用

### 5.3 增量索引

关键设计：**chunk fingerprint = textHash + blockType + sectionPath**。

```ts
if (sameChunkFingerprints(existing, nextChunks)) {
  // 只更新 sourceTitle/sourceUpdatedAt，不重新 embed
  await db.update(knowledgeChunks).set({ sourceTitle, ... })
  return
}
```

结果：**用户只改了标题但内容没变，完全不会调 embedding API**。省钱，也避免每次保存都抖动索引。

### 5.4 Hybrid Retrieval（Agentic RAG）

`retrieveAgenticContext()` 是 Ask AI 每次检索跑的完整管线：

```
输入：query
  │
  ├─ 1. 读取 user 所有 chunks（RLS by userId，fail-closed）
  │
  ├─ 2. BM25 keyword：MiniSearch 建索引
  │    · fields: [title, section, text]
  │    · boost: title×3, section×2, text×1
  │    · 自定义中英混合 tokenizer（含 stopword）
  │    · 取 top-18
  │
  ├─ 3. 语义检索：embed(query) 后和所有 chunk 向量做点积
  │    · 取 top-18
  │
  ├─ 4. RRF（Reciprocal Rank Fusion）融合
  │    · keyword 权重 1.0
  │    · semantic 权重 1.3（语义相对更可靠）
  │    · score[id] += w / (60 + rank)
  │    · 取 top-8 作为 seed
  │
  ├─ 5. 邻域扩展：对每个 seed chunk，把它的 ±1 邻居也纳入
  │    · 相邻 chunk 给一个 0.015 的距离衰减
  │    · 让模型看到上下文，不只是命中那一段
  │
  ├─ 6. Query profile 加权：
  │    · "最近 / 最新" → recent boost（1 天/7 天/30 天 → +6/+4/+2）
  │    · "总结 / 汇总" 且 chunk ≥160 字 → +1
  │    · "笔记" / "收藏" 前缀偏好 → +1.5
  │
  └─ 7. 最终 top-16 返回，按 (score desc, 同源保 chunkIndex 顺序) 排序
```

三个额外的防御/优化点：

- **fail-closed**：没有 userId 直接返回空，杜绝跨用户数据泄露
- **skip RAG**：query 里有"不用搜索 / 直接回答"这类关键词或 `sourceScope='direct'`，跳过检索直接对话
- **Pinned sources**：用户可以在 UI 里选"只基于这几篇笔记回答"，走 `resolvePinnedSources` 直取，绕过检索

### 5.5 Langfuse 追踪

每次检索 + 生成全程有 trace：

- retriever span 记 query + source scope
- agentic-rag span 记所有返回的 chunk meta（不记正文，脱敏）
- generation span 记 provider + model + 输入输出 token

可以在 Langfuse dashboard 回放某次 Ask AI：哪些 chunk 被召回、排序分数、最终生成结果一目了然。

---

## 6. MCP Server（对 Claude Web 暴露工具）

`src/app/api/mcp/route.ts` + `src/server/integrations/`。

**协议**：MCP streamable HTTP transport（JSON-RPC 2.0 over POST），同时暴露 GET 的 SSE keepalive。支持协议版本 `2024-11-05 / 2025-03-26 / 2025-06-18`。

**OAuth 2.0**：

- `/.well-known/oauth-authorization-server`（RFC 8414）
- `/.well-known/oauth-protected-resource`（RFC 9728）
- 授权码 + PKCE 流程
- 未授权请求返回 **401 + `WWW-Authenticate`** 头，里面带 `resource_metadata` URL + `error=invalid_token` / `insufficient_scope` + 描述 —— Claude Web 按这个链 discovery 到 auth server 并触发登录
- Scopes：`knowledge:read` / `knowledge:write_inbox`

**暴露的 4 个 tool**：

- `search_knowledge` — 搜笔记和收藏
- `get_knowledge_item` — 取单条
- `list_recent_knowledge` — 最近列表
- `save_to_knosi` — 保存对话片段到 AI Inbox（**Pro-gated**，调 entitlements 检查 `features.claudeCapture`）

---

## 7. 六大功能模块

### 7.1 Notes

全宽 cover image、type/tags、块级 move/copy/delete/transform、自动保存 + 离开保护、公开只读分享、一键 daily journal（继承昨日 plan）。

### 7.2 Learning Notebook

每个 topic 是一个学习会话，AI 生成 outline、盲点分析（对照已有笔记找缺失概念）、复习题生成、Scoped Ask AI（只在该 topic 笔记范围检索）。

### 7.3 OSS Project Notes

每个项目一个笔记集合，拉 GitHub API 回填 repo metadata，AI 分析存档（长期保留），Discover tab 抓 trending repos。

### 7.4 Ask AI

RAG 管线提供上下文，**可点击来源引用**（每个 chunk 可跳回原笔记高亮位置），流式输出 + 打字机效果，Pro 每天 80 次 / Free 20 次 rate limit（Redis sliding window）。

### 7.5 Portfolio Tracker

持仓 CRUD，Yahoo Finance + CoinGecko 实时价格，AI 持仓分析（集中度、行业分布），新闻聚合用 Marketaux API + Google News RSS fallback，服务端 cron 定时刷新。

### 7.6 Focus Tracker

macOS Tauri 桌面 app 采集，每日热力图 / streak / 应用维度拆分，30 天趋势。

### 7.7 Token Usage Dashboard

扫 `~/.claude/projects/*.jsonl` 每条 session 的 usage 字段，扫 `~/.codex/state*.sqlite` 聚合，按 workspace / subagent 拆分，支持手动录入 OpenAI API / 其它来源。

---

## 8. 部署：Hetzner 单机 + k3s

### 8.1 物理层

**Hetzner Cloud CX23**（4 vCPU / 8 GB / 40 GB SSD）德国 Nuremberg 机房，主机名 `ubuntu-4gb-nbg1-2-knosi`，IP `195.201.117.172`。

### 8.2 Bootstrap

`ops/hetzner/bootstrap.sh` 一键准备：配 swap、装 Docker、装 k3s（带内置 Traefik）、开 UFW 只放 22/80/443、建 `/srv/knosi`。

### 8.3 三层反向代理

```
互联网 ──▶ Caddy（host 上 systemd 或 docker-compose）
              │ 终止 TLS / Let's Encrypt 自动续签
              │ apex / www / k3s.knosi.xyz 都直接 proxy
              ▼
          127.0.0.1:30080（Traefik NodePort）
              │ k3s 的 Ingress Controller
              ▼
           knosi Service:3000
              │
              ▼
            knosi Pod
```

这套拓扑踩过三个值得写出来的坑：

**坑 1**：最早 apex → www 是 Caddy 301 redirect。结果 **MCP streamable transport 的 POST 请求在 301 时不会 re-POST**，Claude Web 直接连不上。改成两个域都直接 proxy 才通。

**坑 2**：MCP `/api/mcp` 响应 401 时必须带 `WWW-Authenticate: Bearer resource_metadata="..."` 头，而且 `/.well-known/oauth-protected-resource` 的 URL 不能写错 scheme/host，否则 Claude Web discovery 不到。专门修过一个 commit：`fix(mcp): emit 401 + WWW-Authenticate and fix OAuth metadata URLs`。

**坑 3**：早期 OAuth callback 在 docker 内部 `HOSTNAME=0.0.0.0` 会导致 `redirect_uri_mismatch`。必须显式设 `AUTH_URL=https://www.knosi.xyz`。

### 8.4 k3s manifests

`ops/k3s/`：

- `00-namespace.yaml` — `knosi` namespace
- `10-redis.yaml` — Redis Deployment + PVC（AOF 持久化）
- `20-knosi.yaml` — 应用 Deployment（image 从本地 containerd 读，`imagePullPolicy: Never`）+ PVC /app/data
  - `initContainer wait-for-redis` 等 Redis 端口
  - `startupProbe` 30×5s（给冷启动 150s）
  - `readinessProbe` 10s / `livenessProbe` 30s 都打 `/login`
  - resources: request 100m CPU / 256Mi，limit 1000m / 768Mi
  - 所有 env 从 Secret `knosi-env` 挂入
- `30-ingress.yaml` — Traefik Ingress，三个 host 指向 `knosi:3000`

### 8.5 CI/CD

`.github/workflows/deploy-hetzner.yml`：push 到 main 就触发一次完整部署。

1. Lint + build sanity check
2. `rsync` 仓库到 `/srv/knosi`（用 `ops/hetzner/rsync-excludes.txt` 排除构建产物）
3. 服务器执行 `ops/hetzner/deploy.sh`：
   - 验证 `docker-compose.prod.yml` 语法
   - 生成唯一的 `NEXT_DEPLOYMENT_ID`（Next.js 部署标识，用于 client bundle 版本校验）
   - `docker compose build knosi`
   - `docker save knosi-knosi:latest | k3s ctr images import -` 导入到 k3s 的 containerd
   - `kubectl create secret --dry-run=client -o yaml | kubectl apply -f -` 刷新 `knosi-env`
   - `kubectl rollout restart deploy/knosi`
   - 轮询 `http://127.0.0.1:3000/login` 返回 200 才算成功

### 8.6 Cron

`ops/hetzner/knosi.cron.example`：

- 每分钟：`POST /api/jobs/tick`（配 `JOBS_TICK_TOKEN`）驱动 RAG 索引 worker
- 每 5 分钟：`POST /api/cron/refresh-portfolio-news`
- 每小时：`collect-ops-snapshot.sh` 写 `/srv/knosi/runtime/ops-snapshot.json`，容器里只读挂载到 `/app/runtime/`，`/settings/ops` 页面读取

### 8.7 观测

- **Langfuse** 接受所有 LLM 调用 trace（OpenTelemetry 协议）
- **/api/metrics** 暴露内部计数器（billing event / cache hit/miss 等）
- **/settings/ops** owner-only 页面：系统指标（和 `free -h` 语义对齐的 used/available/cache/swap）、队列状态、最近部署版本号。只有 `OPS_OWNER_EMAIL` 配置的账号能看，其他人 404

### 8.8 本地开发 / 自部署分流

同一份代码同时支持四种部署场景：

| 场景 | 数据库 | 存储 | AI | 认证 |
|---|---|---|---|---|
| 本地 dev | `file:data/second-brain.db` | fs | 任选 | 默认帐号 test@secondbrain.local |
| Docker self-host | SQLite volume | Docker volume | 任选 | OAuth 或邮密 |
| Hetzner 自部署 | Turso libSQL | S3 兼容（R2） | 任选 | GitHub + Google OAuth |
| Hosted www.knosi.xyz | Turso | R2 | Daemon 默认 | 同上 |

Feature flag 控制可选模块：`ENABLE_PORTFOLIO` / `ENABLE_FOCUS_TRACKER` / `ENABLE_OSS_PROJECTS` / `ENABLE_TOKEN_USAGE`，各自都有 `NEXT_PUBLIC_` 孪生变量让客户端导航能感知。

---

## 9. 工程规范

一些平时很在意的工程纪律：

1. **每个 Phase 必走三步**：`pnpm build` → `pnpm lint` → `pnpm test:e2e`，任何一步红都不合 PR
2. **每个 Phase 都写 `docs/changelog/phase-{N}.md`**：完成功能、改动文件、验证命令、已知风险
3. **HANDOFF.md 协议**：长任务跨会话用一份结构化 handoff 传递状态（进度、走通的路、死路、下一步）
4. **按领域切 schema 文件**，而不是按层
5. **所有 UI 文案强制英文**（注释可中文）
6. **`.claude/rules/` 目录记录 API 差异**（Vercel AI SDK v6、React 19、Tiptap v3），避免踩同一个坑
7. **生产 Turso rollout 必须有记录**，不许停在本地 `db:push`
8. **push 到 main = 自动发布**（GitHub Actions rsync + 滚动 k3s），所以 push 前 build 必须过

---

## 10. 小结

Knosi 的技术决策大多围绕一个目标：**一个人能维护、但又不廉价**。

- 单体 Next.js 避免微服务的运维负担
- SQLite + libSQL 让 dev / prod 代码几乎无差
- 业务表当队列省掉一个 broker
- Daemon 架构把 AI 成本从"持续烧 API"转成"复用用户已有订阅"
- Hybrid RAG 保证没有 embedding provider 也能工作
- MCP + OAuth 让 Claude Web 可以直接调用这个知识库

这些选择都不是理论上最优的，但对一个长期自维护的项目来说是最划算的一组权衡。
