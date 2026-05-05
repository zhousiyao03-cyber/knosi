# Second Brain — 实施计划

## Context

用户是资深前端工程师，想通过构建一个个人知识管理平台来学习全栈开发和 AI Agent 开发。目标是替代 Notion，并加入 AI 能力（摘要、RAG 问答、Agent 工作流）。项目目录：`/Users/bytedance/second-brain`

---

## 技术栈

| 层 | 选型 |
|---|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| UI | Tailwind CSS v4 + shadcn/ui |
| 编辑器 | Tiptap (ProseMirror) |
| API | tRPC v11 |
| 数据库 | SQLite (better-sqlite3) + Drizzle ORM |
| 向量搜索 | orama（纯 JS 全文+向量搜索引擎，零依赖） |
| AI | OpenClaw / Codex OAuth（默认 `gpt-5.4`）+ Vercel AI SDK（可选 OpenAI API 或本地 OpenAI-compatible 服务，如 Ollama / LM Studio） |

---

## 项目结构

```
second-brain/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 根布局（侧边栏+主内容）
│   │   ├── page.tsx              # 首页/仪表盘
│   │   ├── notes/                # 笔记本模块
│   │   │   ├── page.tsx          # 笔记列表
│   │   │   └── [id]/page.tsx     # 笔记编辑
│   │   ├── bookmarks/            # 收藏箱模块
│   │   │   └── page.tsx
│   │   ├── todos/                # Todo 模块
│   │   │   └── page.tsx
│   │   ├── explore/              # AI 探索模块
│   │   │   └── page.tsx
│   │   ├── ask/                  # Ask AI 模块
│   │   │   └── page.tsx
│   │   ├── usage/                # Token usage 模块
│   │   │   └── page.tsx
│   │   ├── workflows/            # AI 工作流模块
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── learn/                # 学习模块
│   │   │   ├── page.tsx          # 学习路径总览
│   │   │   └── [topic]/page.tsx  # 具体课程页
│   │   └── api/
│   │       └── trpc/[trpc]/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 组件
│   │   ├── layout/
│   │   │   ├── sidebar.tsx       # 侧边栏导航
│   │   │   └── header.tsx
│   │   ├── editor/               # Tiptap 编辑器组件
│   │   │   └── tiptap-editor.tsx
│   │   ├── bookmarks/
│   │   ├── todos/
│   │   ├── chat/                 # AI 对话组件
│   │   └── workflows/            # 工作流编辑器组件
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts          # DB 连接
│   │   │   ├── schema.ts         # Drizzle schema（所有表）
│   │   │   └── migrate.ts        # 迁移脚本
│   │   ├── routers/              # tRPC routers
│   │   │   ├── _app.ts           # 根 router
│   │   │   ├── notes.ts
│   │   │   ├── bookmarks.ts
│   │   │   ├── todos.ts
│   │   │   ├── explore.ts
│   │   │   ├── chat.ts
│   │   │   ├── workflows.ts
│   │   │   └── learn.ts
│   │   ├── trpc.ts               # tRPC 初始化
│   │   └── ai/
│   │       ├── summarize.ts      # 摘要 Agent
│   │       ├── recommend.ts      # 推荐 Agent
│   │       ├── rag.ts            # RAG 检索+问答
│   │       ├── vector-store.ts   # 向量存储（orama）
│   │       └── tutor.ts          # AI 导师（学习模块）
│   └── lib/
│       ├── trpc.ts               # tRPC 客户端
│       └── utils.ts
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── next.config.ts
└── .env.local                    # AI_PROVIDER / CODEX_* / OPENAI_* / AI_*
```

---

## 数据库 Schema

### notes 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| title | TEXT NOT NULL | |
| content | TEXT | JSON, Tiptap 格式 |
| plain_text | TEXT | 纯文本，用于搜索和向量化 |
| type | TEXT | 'note' / 'journal' / 'summary' |
| tags | TEXT | JSON 数组 |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### bookmarks 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| url | TEXT | |
| title | TEXT | |
| content | TEXT | 原始内容 |
| summary | TEXT | AI 摘要 |
| tags | TEXT | JSON 数组 |
| source | TEXT | 'url' / 'text' / 'lark' |
| status | TEXT | 'pending' / 'processed' / 'failed' |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### todos 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| priority | TEXT | 'low' / 'medium' / 'high' |
| status | TEXT | 'todo' / 'in_progress' / 'done' |
| category | TEXT | |
| due_date | INTEGER | |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### chat_messages 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| role | TEXT | 'user' / 'assistant' |
| content | TEXT | |
| sources | TEXT | JSON, 引用的文档ID列表 |
| created_at | INTEGER | |

### workflows 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| name | TEXT NOT NULL | |
| description | TEXT | |
| nodes | TEXT | JSON, 工作流节点定义 |
| edges | TEXT | JSON, 节点连接关系 |
| status | TEXT | 'draft' / 'active' |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### learning_paths 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| category | TEXT | 'backend' / 'database' / 'devops' / 'ai' / 'system-design' |
| lessons | TEXT | JSON, 课程列表及顺序 |
| progress | REAL DEFAULT 0 | 0-100 进度百分比 |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### learning_lessons 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| path_id | TEXT FK → learning_paths | |
| title | TEXT NOT NULL | |
| content | TEXT | AI 生成的课程内容 |
| quiz | TEXT | JSON, 练习题 |
| order_index | INTEGER | |
| status | TEXT | 'locked' / 'available' / 'completed' |
| notes | TEXT | 用户学习笔记 |
| completed_at | INTEGER | |

### workflow_runs 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| workflow_id | TEXT FK → workflows | |
| status | TEXT | 'running' / 'completed' / 'failed' |
| results | TEXT | JSON, 每个节点的执行结果 |
| started_at | INTEGER | |
| completed_at | INTEGER | |

### token_usage_entries 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | |
| provider | TEXT | 'codex' / 'claude-code' / 'openai-api' / 'other' |
| model | TEXT | 模型名，可选 |
| total_tokens | INTEGER | 总 token 数 |
| input_tokens | INTEGER | 输入 token，可选 |
| output_tokens | INTEGER | 输出 token，可选 |
| cached_tokens | INTEGER | cache token，可选 |
| notes | TEXT | 备注 |
| source | TEXT | 'manual' / 'import' |
| usage_at | INTEGER | 记录发生时间 |
| created_at | INTEGER | |
| updated_at | INTEGER | |

---

## 分阶段实施计划

### Phase 1：项目骨架 + 基础布局（Day 1）

**目标**：项目跑起来，有完整的导航和布局

1. `pnpm create next-app` 初始化项目
2. 安装依赖：tailwindcss, shadcn/ui, drizzle-orm, better-sqlite3, @trpc/server, @trpc/client, @trpc/next
3. 配置 Drizzle + SQLite 连接
4. 定义所有数据库 schema
5. 搭建 tRPC 基础设施（server/client）
6. 实现侧边栏布局（Dashboard/笔记/收藏/Todo/学习/AI探索/Ask AI/工作流）

**验证**：`pnpm dev` 启动，点击侧边栏各模块能切换页面

---

### Phase 2：笔记本模块（Day 2-3）

**目标**：完整的富文本笔记 CRUD

1. 安装 Tiptap：@tiptap/react, @tiptap/starter-kit, @tiptap/extension-*
2. 实现 TiptapEditor 组件（支持标题、列表、代码块、引用、图片）
3. 实现 tRPC router：notes.list / notes.get / notes.create / notes.update / notes.delete
4. 笔记列表页（搜索、筛选、按时间排序）
5. 笔记编辑页（实时自动保存）
6. 支持笔记类型：普通笔记、日记、总结
7. 标签系统

**验证**：能创建、编辑、删除笔记，富文本格式正常保存和渲染

---

### Phase 3：Todo + 收藏箱模块（Day 4-5）

**目标**：任务管理 + 收藏内容管理

**Todo**：
1. Todo CRUD（tRPC router）
2. Todo 列表（按优先级/状态/分类筛选）
3. 拖拽排序
4. 截止日期提醒

**收藏箱**：
1. 添加收藏（URL/文本/手动输入）
2. URL 自动抓取标题和内容（fetch + cheerio）
3. 收藏列表（按来源/标签筛选）
4. 收藏详情展示

**验证**：能管理 Todo，能添加 URL 并自动抓取内容

---

### Phase 4：AI 能力集成（Day 6-8）✅ DONE

**目标**：接入 AI provider，实现摘要和 RAG 问答

1. 安装 `@ai-sdk/openai`, `ai`（Vercel AI SDK）
2. 收藏箱 AI 摘要：添加收藏后自动调用 AI provider 生成摘要+标签
3. 向量化引擎（orama）
4. Ask AI 对话页面（流式输出 + RAG 检索 + 引用来源）
5. 笔记 AI 辅助：选中文本 → 续写/改写/翻译/摘要

**验证**：粘贴 URL 自动生成摘要；Ask AI 能基于知识库回答问题

---

### Phase 5：AI 探索 + AI 工作流 + 学习模块（Day 9-13）✅ DONE

**学习模块**：
1. 预置学习路径（数据库/API设计/Node.js/DevOps/系统设计/AI Agent）
2. AI 导师（本地/云端 provider 动态生成课程+练习题+答疑）
3. 学习进度追踪
4. 实战关联（关联本项目代码）

**AI 探索**：
1. 基于用户数据分析兴趣
2. AI provider tool calling 调用搜索 API
3. 推荐列表 + 一键收藏

**AI 工作流**：
1. 可视化编辑器（reactflow）
2. 预置节点类型（触发器/抓取/摘要/分类/保存）
3. 执行引擎
4. 预置模板

**验证**：学习路径可用；AI 探索能推荐资料；工作流能创建并运行

---

### Phase 6：Lark 集成 + 完善（Day 14-16）✅ DONE

1. 飞书文档 MCP 对接
2. 首页仪表盘
3. 全局搜索（Cmd+K）
4. 深色模式
5. 数据导出
6. 性能优化

---

## 关键技术决策

1. **SQLite** 而非 PostgreSQL：零配置，个人工具足够用
2. **orama** 而非 pgvector：纯 JS 实现，零外部依赖
3. **tRPC** 而非 REST：端到端类型安全
4. **Tiptap** 而非自研编辑器：成熟的 Block Editor
5. **Vercel AI SDK**：统一 AI 接口，内置流式支持

---

# 后端学习 Plan（Backend Playground）

> 目标：把这个仓库当成后端知识的练兵场。每个 Phase 都围绕仓库里**已经存在的真实数据**（notes / focus / portfolio / jobs / usage）展开，不做玩具例子。
>
> 每个 Phase 的交付物 = 代码 + `docs/learn-backend/phase-{N}.md`（记录：问题、方案、对比、踩坑、思考题）。每个 Phase 结束都要满足自验证三步（build/lint/test:e2e）并 commit。

## 学习 Phase 总览

| Phase | 主题 | 核心概念 | 预计耗时 |
|---|---|---|---|
| B1 | 数据库进阶：事务、并发、N+1 | `db.transaction`、乐观/悲观锁、DataLoader、EXPLAIN | 1–2 天 |
| B2 | 单元测试 + 集成测试 | Vitest、in-memory SQLite、contract test | 1 天 |
| B3 | 可观测性三件套 | 结构化日志 + correlation id、OTel traces、Prometheus `/metrics` | 2 天 |
| B4 | 缓存策略深化 | cache-aside / write-through / write-behind、击穿/穿透/雪崩、singleflight | 1–2 天 |
| B5 | 正经消息队列 + 重试语义 | BullMQ（Redis）vs 现有 SQLite queue、幂等 key、DLQ | 2 天 |
| B6 | Outbox + Saga（分布式一致性） | 事务性 outbox、补偿事务、用 portfolio 交易做例子 | 2 天 |
| B7 | 认证与安全纵深 | RBAC/ABAC、API key 签发、HMAC 验签、审计日志 | 1–2 天 |
| B8 | 限流进阶 + API 契约 | token bucket vs sliding window、OpenAPI 导出、zod → schema | 1 天 |
| B9 | 事件溯源 + CQRS（mini 版） | notes 编辑历史做成事件流、读写模型分离 | 2 天 |
| B10 | 实时与协同 | SSE vs WebSocket、Yjs CRDT、presence | 2–3 天 |

---

## Phase B1 — 数据库进阶：事务、并发、N+1

**为什么现在做**：项目里所有 router 都是直接 `db.select` / `db.insert`，没写过一次 `db.transaction`，没被并发咬过。

**任务**
1. **显式事务**：在 `notes` 或 `portfolio` 中找一个"读 → 改 → 写"的多步操作，包进 `db.transaction`。
2. **并发冲突实验**：写一个脚本模拟两个 worker 同时消费 `knowledgeIndexJobs` 里的同一条任务（现有 `claimNext` 是不是原子的？）。用 `BEGIN IMMEDIATE` / 版本号 / `UPDATE ... WHERE status = 'pending'` 三种方式各实现一遍，比较。
3. **乐观锁**：给 `notes` 加一个 `version` 列，更新时 `WHERE version = ?`，冲突返回 409。
4. **N+1 实验**：在 `dashboard.stats` 或 `learning` router 里构造一个明显的 N+1，用 `EXPLAIN QUERY PLAN` 观察，然后用 `inArray` 批量查询或 DataLoader 模式优化。
5. **索引**：跑一次 `EXPLAIN QUERY PLAN` 看哪些查询走了全表扫描，补 index。

**交付物**
- `scripts/learn/b1-concurrency.mjs` — 并发冲突复现脚本
- `docs/learn-backend/phase-b1.md` — 记录三种并发方案的对比、EXPLAIN 输出、加 index 前后耗时
- 至少一个 router 增加 `db.transaction` 包装
- schema migration：`notes.version`

**验证**
- `pnpm build && pnpm lint && pnpm test:e2e`
- 单独跑并发脚本，确认"没加锁时会双写，加了锁后只有一个 worker 赢"

---

## Phase B2 — 单元测试 + 集成测试

**为什么现在做**：项目现在几乎只有 E2E，改一个纯函数要跑整套 Playwright，反馈太慢。B3 之后会大量重构服务端代码，必须先有安全网。

**任务**
1. 装 Vitest，配 `pnpm test`（区分 `test:unit` / `test:e2e`）。
2. **纯函数单测**：选 3 个纯函数写测试（建议：`src/server/ai/chunking.ts`、`src/server/focus/` 里的切片聚合、`src/lib/note-templates.ts`）。
3. **集成测试**：把 Drizzle 指向内存 SQLite（`:memory:`），对 1 个 tRPC router（建议 `todos` 或 `bookmarks`）写端到端的 router 测试（走真实 DB，但不经过 HTTP）。
4. **覆盖 B1 的并发修复**：为 B1 的乐观锁写一个测试，断言"并发更新会有一个返回 409"。

**交付物**
- `vitest.config.ts`
- `src/server/**/*.test.ts`（至少 5 个文件）
- `docs/learn-backend/phase-b2.md` — 测试金字塔、为什么集成测试要用真实 DB

**验证**
- `pnpm test:unit` 全绿
- 故意改坏一个函数，确认测试能抓到

---

## Phase B3 — 可观测性三件套

**为什么现在做**：你已经有 `pino`、`metrics.ts`、AI rate limit，但缺少把它们串起来的 correlation id 和 trace。后面 Phase 要做性能优化，必须先能"看见"。

**任务**
1. **Correlation id**：在 tRPC middleware 里生成 request id，塞进 `AsyncLocalStorage`，让 `logger` 每条日志自动带上。
2. **OpenTelemetry traces**：接 `@vercel/otel` 或 `@opentelemetry/sdk-node`，在 tRPC、Drizzle、AI provider 调用点打 span。本地跑 Jaeger（docker-compose）看 trace。
3. **Prometheus `/metrics` endpoint**：在 `/api/metrics` 暴露 Prom 格式（现有 `metrics.ts` 先重构成 counter/histogram），本地 docker-compose 起 Prometheus + Grafana，画一张"P95 延迟 by router"的图。
4. **慢查询告警**：logger 里加一个"任何 DB 查询 > 100ms 就 WARN 并带 SQL"的钩子。

**交付物**
- `src/server/observability/` 新目录：context.ts、tracing.ts、metrics-prom.ts
- `docker-compose.observability.yml`
- `docs/learn-backend/phase-b3.md` — 截图：Jaeger trace、Grafana dashboard
- 思考题记录：采样率 vs 全量、日志 vs 指标 vs trace 各自的定位

**验证**
- 触发一次 `/api/chat` 请求，能在 Jaeger 里看到完整 trace（HTTP → tRPC → AI provider → DB）
- Grafana 上 P95 曲线有数据

---

## Phase B4 — 缓存策略深化

**为什么现在做**：你有 Redis + LRU + Next cacheTag，但没系统练过缓存的三种经典坑。

**任务**
1. **三种模式对比**：
   - Cache-aside：`dashboard.stats` 走这个（已经是）
   - Write-through：`portfolio.holdings` 写入时同步更新缓存
   - Write-behind：`focus` 的聚合结果异步落盘
2. **击穿**（热 key 过期瞬间打穿）：用 singleflight 解决（一个 key 只允许一个 goroutine/promise 回源）。手写一个 `withSingleflight` 工具。
3. **穿透**（查不存在的 key 打爆 DB）：加空值缓存或布隆过滤器。
4. **雪崩**（大量 key 同时过期）：给 TTL 加 `±20%` 随机抖动。
5. **标签失效**：现有 Next.js cacheTag + Redis cacheTag 做一次对比，画一张"失效传播路径图"。

**交付物**
- `src/server/cache/singleflight.ts`
- `src/server/cache/patterns/` — 三种模式各一个文件
- `docs/learn-backend/phase-b4.md` — 用 `ab` 或 `autocannon` 压测"加/不加 singleflight"的 QPS 差距

**验证**
- 压测脚本能复现击穿（故意让缓存过期的瞬间来 1000 并发）
- 加 singleflight 后回源 QPS ≈ 1

---

## Phase B5 — 正经消息队列 + 重试语义

**为什么现在做**：现有 `src/server/jobs/queue.ts` 是 pull-based SQLite 队列，学习向可以，但缺 DLQ、优先级、延迟队列、消费者组。

**任务**
1. 装 BullMQ（Redis-backed），把 `knowledgeIndex` 任务双写到 BullMQ，对比两边行为。
2. **幂等 key**：为每个 job 生成 `idempotencyKey`，重复入队直接去重。
3. **DLQ**：失败 5 次后进死信队列，提供一个 `/api/jobs/dlq` tRPC endpoint 查看。
4. **延迟队列**：Portfolio 的"T+1 再算一次"类型任务用 delayed job。
5. **消费者组**：起两个 worker 进程，观察任务分配。
6. **写一篇对比文档**：pull-based SQLite queue vs BullMQ vs Vercel Queues vs Kafka，各自的取舍。

**交付物**
- `src/server/jobs/bullmq.ts`
- `scripts/workers/run-worker.mjs`
- `docs/learn-backend/phase-b5.md` — 对比表 + DLQ 恢复实操记录

**验证**
- 故意让 job 抛异常，确认 5 次后进 DLQ
- 从 DLQ 手动重放，任务能正常完成

---

## Phase B6 — Outbox + Saga（分布式一致性）

**为什么现在做**：B5 之后，"DB 写入 + 发消息"这件事有原子性问题——DB 提了但消息发失败怎么办？这是几乎所有后端系统的经典问题。

**任务**
1. **Transactional Outbox**：
   - 新增 `outbox_events` 表
   - 任何需要"写 DB + 发事件"的地方，改成"写 DB + 写 outbox（同一事务）"
   - 后台 relay worker 扫 outbox，发到 BullMQ，成功后标记 sent
2. **Saga**：Portfolio 里加一个模拟交易流程——"扣余额 → 建持仓 → 更新成本价"。任何一步失败要走补偿（退余额、删持仓）。用状态机实现。
3. **幂等消费者**：消费者见到同 event id 直接 skip。

**交付物**
- schema：`outbox_events`、`saga_runs`
- `src/server/outbox/`
- `docs/learn-backend/phase-b6.md` — 画一张 outbox 流程图 + saga 状态机图

**验证**
- 单测：模拟 relay worker 崩溃，重启后消息最终发出
- 单测：模拟 saga 第 2 步失败，断言第 1 步被回滚

---

## Phase B7 — 认证与安全纵深

**任务**
1. **RBAC**：新增 `roles` / `permissions` / `user_roles` 表，在 tRPC middleware 里做权限检查。给现有 router 标注 required permission。
2. **API key**：给用户签发带前缀的 API key（`sk_live_...`），DB 只存 sha256，支持轮换。
3. **HMAC webhook**：为 workflow 增加一个 webhook 接收端点，用 HMAC 签名验证请求来源。
4. **审计日志**：新增 `audit_logs` 表，记录 who/what/when/ip/user-agent，对敏感操作（删除笔记、改 portfolio）强制写入。

**交付物**
- schema：`roles`、`permissions`、`api_keys`、`audit_logs`
- `src/server/auth/rbac.ts`、`src/server/auth/api-key.ts`
- `docs/learn-backend/phase-b7.md`

**验证**
- E2E：无权限用户访问被 403
- 单测：错误 HMAC 签名被拒绝

---

## Phase B8 — 限流进阶 + API 契约

**任务**
1. 把 `ai-rate-limit.ts` 重构成可插拔策略：fixed window / sliding window / token bucket / leaky bucket 四种都实现一遍，写基准测对比内存占用和平滑度。
2. **全局限流 vs 用户级限流**：用 Redis Lua 脚本实现原子 token bucket。
3. **OpenAPI 导出**：用 `trpc-openapi` 或手写，把 tRPC router 导出成 OpenAPI spec，挂到 `/api/openapi.json`。
4. **zod → JSON Schema**：对外暴露的错误码也生成 schema。

**交付物**
- `src/server/rate-limit/strategies/`
- `src/server/openapi/`
- `docs/learn-backend/phase-b8.md`

**验证**
- 压测脚本：突发流量下 sliding window 比 fixed window 平滑
- 能用 `curl /api/openapi.json` 拿到合法 OpenAPI 3.1 文档

---

## Phase B9 — 事件溯源 + CQRS（mini 版）

**任务**
1. **Event store**：`note_events` 表，记录 NoteCreated / NoteEdited / NoteDeleted 每个事件。
2. **Projector**：一个 worker 把事件投影成当前的 `notes` 表（等于现有表，只是来源变了）。
3. **回放**：写一个命令能从任意时间点回放事件重建 state。
4. **CQRS**：读模型另外建一张 `notes_read_model`（冗余但利于查询），写走 events，读走 read model。
5. 和 B6 的 outbox 结合：事件落库后自动发到消息总线。

**交付物**
- schema：`note_events`、`notes_read_model`
- `src/server/events/`
- `docs/learn-backend/phase-b9.md` — 讨论：什么场景值得上 ES？什么场景会被它反噬？

**验证**
- 清空 `notes_read_model` 后从事件重建，和原数据一致
- 单测：一个 note 的编辑历史可以按时间回放

---

## Phase B10 — 实时与协同

**任务**
1. **SSE vs WebSocket**：现有 AI chat 是 SSE，加一个 WebSocket endpoint 做对比（presence / 实时通知）。
2. **Yjs CRDT**：为单篇 note 加多设备协同编辑。Tiptap 本来就支持 Yjs collab extension。
3. **Presence**：头像角标，显示"谁在看这篇笔记"。Redis pub/sub 实现。
4. **断线重连**：客户端断网重连后能同步离线期间的变更（Yjs 天然支持）。

**交付物**
- `src/server/realtime/`
- `docs/learn-backend/phase-b10.md` — SSE / WebSocket / Long polling 三者对比

**验证**
- 两个浏览器窗口开同一篇 note，一个编辑另一个实时看到
- 断网 30 秒再连回来，变更合并正确

---

## 学习 Phase 的执行协议

- 每个 Phase 开始前：先在 `docs/learn-backend/phase-b{N}.md` 写一段"我现在对这个主题的理解是什么"（before-state），结束后再写一段"现在我学到了什么"（after-state）。
- 每个 Phase 允许并且鼓励"故意写错一版，观察症状，再改对"——错误案例也要留档。
- 每个 Phase 结束都走一次自验证三步并 commit，commit message 格式：`learn(b{N}): {主题}`。
- 不允许为了赶进度跳过"对比实验"——学习 Phase 的价值就在对比。

## 建议执行顺序

**第一梯队（必做，顺序重要）**：B1 → B2 → B3

- B1 打基础（事务/并发/索引是一切后端的根）
- B2 立安全网（后面重构不慌）
- B3 装眼睛（后面优化能看到效果）

**第二梯队（选做，可并行）**：B4（缓存）、B7（安全）、B8（限流）—— 相对独立，想到哪做哪。

**第三梯队（高级，依赖前面）**：B5 → B6 → B9 —— 这是一条"异步 + 一致性"的主线，B6 建立在 B5 的 MQ 上，B9 建立在 B6 的 outbox 上。

**第四梯队（大 boss）**：B10 —— 实时协同本身就是一个完整课题，放最后。
