# Ask AI M2 — @mention Pinned Sources Implementation Plan

**Goal:** 让用户在编辑器内的 `InlineAskAiPopover` 中输入 `@` 时弹出搜索菜单，可以"钉"选具体的 note / bookmark 作为**硬上下文**。被钉住的 source 会以完整 plain text 形式注入 system prompt，AI 基于它们而不是全局 RAG 回答；被钉住的 source 也会以 chip 形式显示在 popover 顶部可一键移除。

**Why M2 (vs M1):**
- M1 已经让用户在编辑器里呼出 AI，但 AI 的上下文只有"当前 note 的全文"（contextNoteText）。
- 当用户想让 AI 基于"前天那篇日报 + 昨天那个 bookmark"回答时，现在只能去 /ask 页面改 scope，效率太低。
- M2 解决这个：用户在 popover 里直接 `@` 钉选任意 note/bookmark，强制进入 pinned context。

**Architecture:**
- **纯前端 @ 菜单**（不装 Tiptap mention 扩展）：textarea `onChange` 里检测"最近一个 `@` 到 caret 之间的 query"，下拉菜单绝对定位到 popover 内部。用户选中后 query token 从 input 里剪掉，source 塞进 `pinnedSources` state。
- **已钉 chip 展示**：popover 顶部一行显示 pinned chip，每个 chip 右侧 X 按钮移除。
- **后端一次往返**：扩展 `chatInputSchema`，加 `pinnedSources: Array<{ type: 'note'|'bookmark', id: string }>`。在路由里先直接从 db 查这些 source 的完整内容（筛 userId），然后把它们作为新的 `pinnedSources` option 传给 `buildSystemPrompt`，在 prompt 里以 `<pinned_sources>` XML 段落出现，优先级高于 RAG。
- **兼容性**：如果用户同时开了 RAG（`sourceScope !== "direct"`），pinned sources 是**叠加**而不是替换——RAG 继续跑，最终 system prompt 同时有 `<pinned_sources>` 和 `<knowledge_base>`。inline popover 当前强制 `sourceScope: "direct"`，所以 inline 场景实际上只有 pinned；但 API 层保持通用，将来 Ask AI 主页面也能用。

**Tech Stack:** Next.js 16, React 19, Tiptap v3, `@ai-sdk/react`, tRPC v11, zod/v4, Tailwind. 不新增依赖。

**Scope boundaries（本 Milestone 不做）：**
- ❌ @mention 扩展到 Tiptap 文档本身（note 里可以 `@` 留一个持久链接）——太大，留给后续
- ❌ 出结构化 Tiptap blocks 作为 AI 输出（M3）
- ❌ 多模态（M4）
- ❌ Inline citation 角标（M5）

---

## File Structure

### Create
- `src/components/editor/inline-ask-ai-mention-menu.tsx` — @ 菜单浮层子组件，负责搜索 + 键盘导航 + 结果渲染。~130 行。
- `e2e/ask-ai-mention.spec.ts` — 覆盖 @ 搜索 / 选中 / 取消 / chip 显示 / 请求 body 三条核心路径。

### Modify
- `src/components/editor/inline-ask-ai-popover.tsx`
  - 加 `pinnedSources` state
  - textarea onChange 里做 @ 检测，打开 mention menu
  - 顶部渲染 pinned chip bar（可移除）
  - sendMessage body 带上 `pinnedSources: [{ id, type }]`（只发 id/type，不发 title，避免客户端伪造）
- `src/app/api/chat/route.ts`
  - `chatInputSchema` 加 `pinnedSources`
  - 在 RAG 分支之前（或并行）从 db 查完整内容，转成 `RetrievedKnowledgeItem[]`，作为 `options.pinnedSources` 传给 `buildSystemPrompt`
  - daemon 分支：加 TODO，暂不处理（与 M1 contextNoteText 同策略，inline 强制 stream 模式）
- `src/server/ai/chat-system-prompt.ts`
  - `BuildSystemPromptOptions` 加 `pinnedSources?: RetrievedKnowledgeItem[]`
  - 新增 `withPinnedSources(base, options)`，在 `<pinned_sources>` 段落里列出
  - 在 `withNoteContext` 之后再调用 `withPinnedSources`
- `docs/changelog/2026-04-10-ask-ai-m2-mention-pinning.md` — M2 留档

---

## Task 1 — Backend: schema + DB lookup + system prompt injection

**Files:**
- Modify: `src/server/ai/chat-system-prompt.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Extend `BuildSystemPromptOptions` + add `withPinnedSources`**

  在 `BuildSystemPromptOptions` 里加：
  ```ts
  pinnedSources?: RetrievedKnowledgeItem[];
  ```

  新增函数：
  ```ts
  function withPinnedSources(base: string, options?: BuildSystemPromptOptions) {
    const pinned = options?.pinnedSources;
    if (!pinned || pinned.length === 0) return base;
    const block = pinned
      .map((item) => {
        const header = `<pinned_source id="${item.id}" type="${item.type}" title="${item.title}">`;
        return `${header}\n${item.content.slice(0, 6000)}\n</pinned_source>`;
      })
      .join("\n\n");
    return `${base}

---

用户钉住了以下 source，作为回答这个问题的**优先上下文**。请把这些当作权威来源，在回答里明确基于这些内容；如果它们不够回答问题，再退回其它知识或直接说不知道：

<pinned_sources>
${block}
</pinned_sources>`;
  }
  ```

  在 `buildSystemPrompt` 的每一个 `withNoteContext(...)` 返回值外面再包一层 `withPinnedSources(...)`（三处：no-context / direct / has-context 分支）。

- [ ] **Step 2: Extend chat request schema**

  `chatInputSchema`：
  ```ts
  pinnedSources: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(["note", "bookmark"]),
      })
    )
    .max(10)
    .optional(),
  ```

- [ ] **Step 3: Resolve pinned sources from DB at request time**

  在 `route.ts` 的 `POST` handler 里，在 daemon 分支之前（daemon 分支也要能 skip 或跟进），加一个 helper：
  ```ts
  async function resolvePinnedSources(
    pins: Array<{ id: string; type: "note" | "bookmark" }>,
    userId: string | null
  ): Promise<RetrievedKnowledgeItem[]> {
    if (!pins.length || !userId) return [];
    const noteIds = pins.filter((p) => p.type === "note").map((p) => p.id);
    const bookmarkIds = pins.filter((p) => p.type === "bookmark").map((p) => p.id);

    const items: RetrievedKnowledgeItem[] = [];
    if (noteIds.length) {
      const rows = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.plainText,
        })
        .from(notes)
        .where(and(eq(notes.userId, userId), inArray(notes.id, noteIds)));
      for (const r of rows) {
        items.push({
          id: r.id,
          title: r.title ?? "未命名",
          type: "note",
          content: r.content ?? "",
        });
      }
    }
    if (bookmarkIds.length) {
      const rows = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          content: bookmarks.content,
          summary: bookmarks.summary,
          url: bookmarks.url,
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.id, bookmarkIds)));
      for (const r of rows) {
        items.push({
          id: r.id,
          title: r.title ?? r.url ?? "未命名",
          type: "bookmark",
          content: r.content ?? r.summary ?? "",
        });
      }
    }
    return items;
  }
  ```

  **SECURITY:** 必须用 `userId` scope 筛选，防止跨用户钉别人 source。`AUTH_BYPASS` 环境下 `userId` 是 `"test-user"`（参考 global-setup.ts），所以 E2E 也能跑。

- [ ] **Step 4: Wire `pinnedSources` into `buildSystemPrompt` call**

  stream 分支：
  ```ts
  const pinned = await resolvePinnedSources(
    parsed.data.pinnedSources ?? [],
    userId
  );
  // ... buildSystemPrompt 调用处：
  system: buildSystemPrompt(context, sourceScope, {
    contextNoteText: parsed.data.contextNoteText,
    pinnedSources: pinned,
  }),
  ```

  daemon 分支：加 TODO 注释，暂不处理，inline 强制 stream 所以不阻塞：
  ```ts
  // TODO(ask-ai M2 follow-up): daemon mode currently ignores pinnedSources.
  ```

- [ ] **Step 5: Build + lint**

  `pnpm build` ✅；`pnpm lint` 对修改文件 ✅。

- [ ] **Step 6: Commit**

  ```
  feat(ask-ai): backend plumbing for pinnedSources (@mention M2 step 1)
  ```

---

## Task 2 — Frontend: mention menu sub-component

**Files:**
- Create: `src/components/editor/inline-ask-ai-mention-menu.tsx`

- [ ] **Step 1: Component contract**

  ```tsx
  interface Props {
    query: string;
    onSelect: (source: { id: string; type: "note" | "bookmark"; title: string }) => void;
    onClose: () => void;
  }
  ```

  内部：用 `trpc.dashboard.search.useQuery({ query }, { enabled: query !== null })` 拉结果；自管 `activeIndex` 做键盘导航；listen 全局 `keydown` 处理 ↑/↓/Enter/Esc。

- [ ] **Step 2: UI**

  - 外层是 `absolute` 定位的下拉框（绝对定位相对 popover 容器）
  - 分组展示：笔记在上，收藏在下，每组 max 5 条
  - 每行：icon + title（高亮 query 可以后续加）
  - 空状态：`"没有匹配的 source"`；loading：`Loader2` 转圈
  - Notes icon: `FileText` (lucide)，bookmarks: `Bookmark`

- [ ] **Step 3: Commit**

  ```
  feat(ask-ai): add inline mention menu component (M2 step 2)
  ```

---

## Task 3 — Frontend: integrate @ detection into popover

**Files:**
- Modify: `src/components/editor/inline-ask-ai-popover.tsx`

- [ ] **Step 1: Add state**

  ```ts
  const [pinnedSources, setPinnedSources] = useState<
    Array<{ id: string; type: "note" | "bookmark"; title: string }>
  >([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  ```

- [ ] **Step 2: Detect `@` in `onChange`**

  写一个 helper `detectMentionQuery(value: string, caret: number): string | null`：
  - 从 caret 往前找最近的 `@`
  - 如果 `@` 前面是行首或空白字符 → 合法触发位
  - 返回 `@` 后面到 caret 之间的字符串（允许为 ""）
  - 如果中间有空格或换行 → 取消，返回 null

  textarea `onChange` 里：
  ```ts
  const value = e.target.value;
  const caret = e.target.selectionStart ?? value.length;
  setInput(value);
  setMentionQuery(detectMentionQuery(value, caret));
  ```

- [ ] **Step 3: Render `<InlineAskAiMentionMenu>` conditionally**

  在 popover 的 textarea 下方绝对定位渲染，query 非 null 时 mount。

- [ ] **Step 4: `onSelect` handler**

  - 把 pinned 加入 `pinnedSources` state（去重 by id）
  - 从 input 里切掉 `@query` token（找到最近的 `@`，替换为空串）
  - `setMentionQuery(null)`
  - refocus textarea

- [ ] **Step 5: Pinned chip bar**

  在 textarea 正上方，flex row，每个 chip 展示 icon + title + `×` 按钮；点 `×` 从 state 移除。

- [ ] **Step 6: Pass `pinnedSources` to sendMessage**

  ```ts
  sendMessage(
    { text: finalPrompt },
    {
      body: {
        sourceScope: "direct",
        contextNoteText: noteText.slice(0, 8000),
        pinnedSources: pinnedSources.map((s) => ({ id: s.id, type: s.type })),
      },
    }
  );
  ```

- [ ] **Step 7: Reset state on popover re-open**

  anchor 变化时清空 `pinnedSources` 和 `mentionQuery`。

- [ ] **Step 8: Build + lint**

- [ ] **Step 9: Commit**

  ```
  feat(ask-ai): @mention chips inside inline ask popover (M2 step 3)
  ```

---

## Task 4 — E2E coverage

**Files:**
- Create: `e2e/ask-ai-mention.spec.ts`

- [ ] **Step 1: Setup**

  - Seed 至少一条 note + 一条 bookmark 进 db（通过 UI 创建即可：进入 /notes 新建，设置 title 为 `MENTION_TARGET_NOTE`）
  - Mock `/api/chat` 路由，fulfill 一个 static 文本（回应）
  - 用 `request.on("request")` 或直接拦截请求 body 捕获发送的 pinnedSources

- [ ] **Step 2: Three scenarios**

  1. 打 `/ai` 打开 popover → 输入 `@MENTION` → mention menu 出现 → 点目标 note → chip 出现 → 发送 → mock 收到的 body 包含 `pinnedSources: [{ id, type: "note" }]`
  2. 有 pin 后点 chip 的 `×` → chip 消失 → 发送 → body pinnedSources 为空或不含
  3. @ 菜单出现后按 Esc → 菜单消失但 popover 仍在

- [ ] **Step 3: Run**

  `pnpm test:e2e e2e/ask-ai-mention.spec.ts`
  预期：all green。

- [ ] **Step 4: Commit**

  ```
  test(ask-ai): e2e for @mention pinned sources flow
  ```

---

## Task 5 — Changelog + full verification

- [ ] `pnpm build` ✅
- [ ] `pnpm lint` ✅（新文件 0 warning）
- [ ] `pnpm test:e2e`（确认没新 regression）
- [ ] 写 `docs/changelog/2026-04-10-ask-ai-m2-mention-pinning.md`
- [ ] Commit: `docs(ask-ai): changelog for M2 @mention pinning`

---

## Success criteria

- 用户在 popover 里输入 `@foo` 能看到搜索菜单
- 能选中 note 或 bookmark 变成 chip
- chip 可以移除
- 发送请求的 body 里带 pinnedSources 列表
- 后端收到后实际用 userId 查 db 拉完整内容
- system prompt 里出现 `<pinned_sources>` 段落
- E2E 新 spec 全绿
- build / lint / 全量 e2e 相对 baseline 无回归
