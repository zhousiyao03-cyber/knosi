# 2026-03-22 - Ask AI Agentic RAG Foundation

Task / goal:
- 将 Ask AI 从“整篇文本启发式匹配”升级为可落地的 chunk 级 hybrid RAG 基础设施：支持笔记 / 收藏切片、embedding 落库、邻近段落扩展和旧检索兜底。

Key changes:
- 新增知识索引表：
  - `knowledge_chunks`：按 chunk 保存切片正文、来源、section path、block type 和 hash。
  - `knowledge_chunk_embeddings`：保存 chunk 对应的 embedding 向量。
  - `knowledge_index_jobs`：记录索引任务执行状态。
- 新增 `src/server/ai/chunking.ts`：
  - 对 Tiptap 笔记内容按 heading / block 做结构化切片。
  - 对 bookmark 内容按段落回退切片。
- 新增 `src/server/ai/embeddings.ts`：
  - 独立解析 `EMBEDDING_PROVIDER`。
  - 支持 OpenAI 和本地 OpenAI-compatible embedding provider。
  - 将 embedding 归一化后以 `Float32Array` blob 形式落库。
- 新增 `src/server/ai/indexer.ts`：
  - 为 note / bookmark 提供索引同步、删除和首次 lazy seed 能力。
  - 内容 hash 未变化时跳过重复 embedding。
  - embedding 失败时退化为 chunk-only 索引，不阻塞主写入。
- 新增 `src/server/ai/agentic-rag.ts`：
  - 对 chunk 做关键词打分与语义召回融合。
  - 用 RRF 做 hybrid rank fusion。
  - 命中 seed chunk 后自动扩展相邻 chunk，补齐上下文。
- 更新 `src/app/api/chat/route.ts`：
  - Ask AI 优先走新的 chunk 级检索。
  - 若新索引未命中，则回退到原有 `src/server/ai/rag.ts` 逻辑，避免功能断层。
- 更新 `src/server/routers/notes.ts` 与 `src/server/routers/bookmarks.ts`：
  - create / update / delete 触发知识索引同步或删除。
  - 索引改为后台触发，避免保存笔记 / 收藏时被 embedding 阻塞。
- 更新 `README.md` 与 `.env.example`：
  - 补充 embedding provider 配置方式。
  - 说明 Ask AI 现在是 chunk 级 hybrid RAG，未配置 embedding 时会回退为关键词检索。

Files touched:
- `.env.example`
- `README.md`
- `drizzle/0001_strange_kat_farrell.sql`
- `drizzle/meta/0001_snapshot.json`
- `drizzle/meta/_journal.json`
- `src/app/api/chat/route.ts`
- `src/server/ai/agentic-rag.ts`
- `src/server/ai/chunking.ts`
- `src/server/ai/embeddings.ts`
- `src/server/ai/indexer.ts`
- `src/server/db/schema.ts`
- `src/server/routers/bookmarks.ts`
- `src/server/routers/notes.ts`
- `docs/changelog/ask-ai-agentic-rag-foundation.md`

Verification commands and results:
- `PATH=/usr/local/bin:$PATH; pnpm lint` -> ✅ 通过。
- `PATH=/usr/local/bin:$PATH; pnpm db:generate` -> ✅ 生成新迁移 `drizzle/0001_strange_kat_farrell.sql`。
- `PATH=/usr/local/bin:$PATH; pnpm db:push` -> ✅ 新表已应用到本地 SQLite。
- `PATH=/usr/local/bin:$PATH; pnpm build` -> ✅ Next.js 16.2.1 构建通过。
- `PATH=/usr/local/bin:$PATH; pnpm exec playwright test e2e/phase4.spec.ts e2e/v1-core-paths.spec.ts --reporter=line` -> ✅ `18 passed`。
- `PATH=/usr/local/bin:$PATH; sqlite3 -header -column data/second-brain.db ".tables"` -> ✅ 可见 `knowledge_chunks`、`knowledge_chunk_embeddings`、`knowledge_index_jobs`。
- `PATH=/usr/local/bin:$PATH; sqlite3 -header -column data/second-brain.db "SELECT COUNT(*) AS chunks FROM knowledge_chunks; SELECT COUNT(*) AS embeddings FROM knowledge_chunk_embeddings; SELECT source_type, COUNT(*) AS rows FROM knowledge_chunks GROUP BY source_type ORDER BY source_type;"` -> ✅ 当前本地库中已有 `39` 条 chunk，按来源分为 `note=33`、`bookmark=6`；embedding 数为 `0`，说明当前环境未配置可用 embedding provider，系统已按预期退化为关键词检索。

Remaining risks / follow-up:
- 现在的“后台索引”是应用内 fire-and-forget 触发，适合本地开发和单机运行，但在严格的 serverless / 短生命周期环境里不如专门队列稳。后续可考虑改为显式 job runner，或在 Next 请求上下文里使用更可靠的 after / queue 机制。
- 语义检索能力依赖 `EMBEDDING_PROVIDER`。如果只配置了 Codex 聊天、没有配置 OpenAI 或本地 embedding provider，Ask AI 会继续工作，但只会用 chunk 级关键词召回。
- 目前 hybrid retrieval 仍在内存里做向量相似度和 rank fusion；当知识库规模继续增大后，可以再评估引入真正的向量索引或 FTS5 / Orama 做更强的召回层。
