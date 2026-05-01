# Council Phase 2 — Brainstorming 入口

**Status**: WAITING_FOR_USAGE — 等周思尧用过几次 Phase 1 后再启动

## 怎么用这个文档

下次想做 Phase 2 时直接说：「启动 council phase 2」。我会读这个文档 + 你的"用了之后的真实抱怨"，把抱怨映射成下面的候选项，然后只做 1~3 项收敛成 spec → plan → 实现。**不要一次做完所有候选项**，YAGNI。

## Phase 1 留下的尾巴（spec §13 + Phase 2 优化点 + plan 实现期记录）

### 候选项 A：产品化
- **A1. Channel CRUD UI** — 列表 / 新建 / 删除多频道；当前固定一个默认频道
- **A2. Persona CRUD UI** — 用户自定义 persona 名字 + scope + systemPrompt + tags；当前 3 个预置写死
- **A3. 沉淀为笔记** — 选中一段讨论一键生成 Knosi 笔记（带回链）；UI 已留 hover ⋯ 钩子，后端 API 未做

### 候选项 B：工程深化
- **B1. Cheap-model classifier 通道** — 让 should-speak 走 haiku/gpt-4o-mini，预计省 80% classifier token。需要 provider 抽象加 `modelHint: "cheap"` 或独立 cheap 通道
- **B2. Wall-clock 内部 AbortController** — 当前 90s wall-clock guard 不能 mid-stream cancel（仅 between-iteration 检查）。Phase 2 用内部 AbortController 串联 user signal + timer，让 stalled stream 也能被截断
- **B3. Chunks 表加冗余 tags 列** — 当前 tag 过滤要 join 回 notes/bookmarks 表。数据量大时性能问题。要么加冗余 tags 字段 + indexer 同步，要么单独 chunk_tags 关联表
- **B4. Codex / claude-daemon mode 的 council 路由** — 当前 council 强制走 ai-sdk（openai/local），用户设的 codex/daemon 被忽略。要么扩展 streamPlainTextAiSdk 支持那两条路径，要么至少 UI 提示用户

### 候选项 C：体感打磨
- **C1. Markdown 流式渲染** — 当前流式过程中是纯文本，结束后才 render markdown。流式 markdown 渲染容易闪烁但更爽
- **C2. Persona 颜色 / 头像 / 动画** — 当前用 4 色 palette + emoji avatar。可以让用户自定义颜色、加更细的动画
- **C3. Stop reason 文案细化** — 当前 5 种 stopped reason 用中文化系统消息显示。可以加更细的视觉差异
- **C4. 历史 truncate summarization** — 永久 channel 历史长起来后早期对话被裁剪。Phase 2 加后台 summarization 落库
- **C5. 输入框微交互** — Enter 发送、Shift+Enter 换行已有；可加 @ persona 自动补全（虽然 Phase 1 turn-taking 不依赖 @）

### 候选项 D：超出 Phase 1 spec 范围（Phase 3 候选）
- **D1. learning-notebook / oss-project scope** — 需要先扩展 RAG 索引器支持 `learning-note` / `project-note` source type
- **D2. Async daemon 模式** — 让 council 讨论在后台跑完，用户回头看（结合现有 daemon 基础设施）
- **D3. 多频道 cross-reference** — 一个频道引用另一个的讨论
- **D4. Checkpoint / 断线恢复**

## Phase 1 spec 注脚记录的两个修订（不影响 Phase 2 决策）

1. 终止条件简化：去掉 `consecutiveNoToStop` 字段，全员 no = 立即终止（reclassify 上下文不变化时等价）
2. scope 缩减为 `all` / `notes` / `bookmarks`（learning-notebook / oss-project 推到 D1）

## Phase 2 brainstorming 启动协议

下次会话：

1. **先问周思尧**："Phase 1 用了几次？哪一处最让你不舒服？" — 真实抱怨优先于这个文档的列表
2. 把抱怨**映射**到 A/B/C/D 候选项（一个抱怨可能对应多项）
3. 按"取向"问：A 产品化 / B 工程深化 / C 体感 / D 大跳跃
4. **选 1~3 项**就停。多了 spec 写不完、做不完
5. 进 brainstorming flow：clarifying questions → 设计 → 写 spec → 写 plan → 实现

## Phase 1 已上线状态（Snapshot at 2026-05-01）

- 分支：merged 到 main，已 push、Hetzner deploy 应已完成
- 生产 schema：4 张 council_* 表 + users FK 已 rollout
- 单测：15/15 通过
- E2E：Phase 1 跳过（用户决定）
- 模块入口：`/council`（侧边栏 CAPTURE 组）
- 3 个预置 persona：AI 工程师 / 后端架构师 / 产品经理

## 当时取舍记录（可能 Phase 2 重新开闸）

- 不做 LangGraph / Mastra：Phase 1 选了"自造 + 借鉴 OpenAI Swarm handoff"。Phase 2 如果 turn-taking 状态机变复杂可重新评估
- 单频道 ≤ 3 agent：UI 限制，schema 不写死。Phase 2 改 UI 即可放开
- 不做 e2e：用户决定。Phase 2 如果改了 turn-taking / abort 链路，建议补回

## 文件索引

- Spec: `docs/superpowers/specs/2026-05-01-council-multi-agent-room-design.md`
- Plan: `docs/superpowers/plans/2026-05-01-council-multi-agent-room.md`
- Changelog: `docs/changelog/2026-05-01-council-phase-1.md`
- Schema: `src/server/db/schema/council.ts`
- 核心代码: `src/server/council/`
- 前端: `src/app/(app)/council/`
