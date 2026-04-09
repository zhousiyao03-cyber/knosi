# Ask AI Notion-Alignment — Overview & Roadmap

> **状态**：规划总览（不是可执行计划）。每个 Milestone 的可执行计划单独存放在同目录下的 `2026-04-09-ask-ai-m{N}-*.md`。

## 背景

当前 `/ask` 页面的 Ask AI 功能相对 Notion Ask AI 缺乏以下关键能力：

1. 被困在 `/ask` 全页，没进入编辑器
2. 没有 `@` 引用机制（RAG 只能全局 scope，不能钉死特定 note）
3. 所有答案都是只读文本，没有"动作层"
4. 没有多模态（PDF / 图片）
5. 没有 inline citation
6. 没有文本改写类 quick actions

已有的底子（不要重做）：
- Hybrid RAG（keyword + semantic + RRF）in `src/server/ai/agentic-rag.ts`
- Chunking 520/120 + sectionPath in `src/server/ai/chunking.ts`
- 4 provider 抽象 in `src/server/ai/provider.ts`
- URL 抓取 in `src/server/ai/fetch-content.ts`
- Daemon 模式任务队列 in `src/server/ai/chat-enqueue.ts`
- `/api/chat` 同时支持 stream + daemon 两种模式 in `src/app/api/chat/route.ts`

## Roadmap

按 ROI 顺序，每个 Milestone 独立可 ship：

| M | 目标 | 工程量 | 计划文件 |
|---|---|---|---|
| **M1** | 编辑器内 Ask AI：`/ai` slash 命令 + Bubble toolbar "Ask AI" 子菜单；答案作为 block 插入 | 2-3 天 | `2026-04-09-ask-ai-m1-editor-inline.md` |
| **M2** | `@mention` 引用具体 note/bookmark 作为硬上下文 | 2-3 天 | 待 M1 完成后编写 |
| **M3** | 输出动作层：Insert / Replace / Append to existing note；AI 输出结构化 Tiptap blocks | 3-4 天 | 待 M2 完成后编写 |
| **M4** | 多模态：PDF / 图片上传作为 ephemeral context | 3-5 天 | 待 M3 完成后编写 |
| **M5** | Inline citations：`[[src-N]]` → 上标角标 + 悬停预览 | 2 天 | 待 M4 完成后编写 |
| **M6** | Research Mode：长任务多轮检索，输出分节报告（复用 daemon） | 4-5 天 | 待评估 |

## 执行原则

- **每个 Milestone 单独 commit 多次**（按 task 内 step）
- **每个 Milestone 结束做一次 `pnpm build && pnpm lint && pnpm test:e2e`**
- **每个 Milestone 结束在 `docs/changelog/` 留档**
- **先做 M1**，做完后再基于实际经验写 M2 的计划（避免 over-planning）

---

**下一步**：开始执行 `2026-04-09-ask-ai-m1-editor-inline.md`
