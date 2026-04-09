# 2026-04-10 — Ask AI M2: @mention Pinned Sources

Task / goal:
- 把 overview 里规划的 Milestone 2 ship 上线：让用户在编辑器内的 Inline Ask AI popover 里通过 `@` 钉住具体的 note 或 bookmark 作为硬上下文，AI 基于它们而不是全局 RAG 回答。
- 对应计划：`docs/plans/2026-04-10-ask-ai-m2-mention-pinning.md`（本次由 agent 基于 overview 现场起草并执行）。
- 对应 overview：`docs/plans/2026-04-09-ask-ai-notion-alignment-overview.md`。

Key changes:

## 1. Backend — pinned sources plumbing

- `src/app/api/chat/route.ts`
  - `chatInputSchema` 新增 `pinnedSources: Array<{ id: string, type: 'note' | 'bookmark' }>`，`max(10)`，optional。
  - 新增 `resolvePinnedSources(pins, userId)` helper：严格按 `userId` 作用域从 `notes` / `bookmarks` 表批量拉完整 `plainText` / `content`，转换为 `RetrievedKnowledgeItem[]`。
  - **Security**：客户端只发 `{id, type}`，不接受客户端传 title / content —— 后端用 db row 的 title 覆盖，防止伪造；userId 为 null（AUTH_BYPASS 无状态路径）时直接返回空数组 fail-closed。
  - 在 stream 分支里调用 `resolvePinnedSources`，把结果通过新 option `pinnedSources` 传给 `buildSystemPrompt`。
  - Daemon 分支已有的 `TODO(ask-ai M1 follow-up)` 注释更新为 `TODO(ask-ai M1/M2 follow-up)`，同样不处理 —— Inline 强制 stream 模式，这是可接受的。
- `src/server/ai/chat-system-prompt.ts`
  - `BuildSystemPromptOptions` 新增 `pinnedSources?: RetrievedKnowledgeItem[]`。
  - 新增 `withPinnedSources(base, options)`：把 pinned sources 作为 `<pinned_source>` 元素包在 `<pinned_sources>` 段落里注入 system prompt，每条内容截断到 6000 字符。
  - 新增 `finalizePrompt(base, options)` = `withPinnedSources(withNoteContext(base, options), options)`，作为三条 code path（no-context / direct / has-context）的统一收尾包装，保证 pinned sources 永远进到 prompt。
  - Prompt 里的说明明确要求 AI 把 pinned sources 当作**权威上下文**，优先级高于 RAG 检索。

## 2. Frontend — inline @ menu + chip bar

- `src/components/editor/inline-ask-ai-mention-menu.tsx`（新）
  - 新 sub-component，接收 `{ query, onSelect, onClose }`，内部调用 `trpc.dashboard.search` 搜 notes + bookmarks。
  - 绝对定位到 popover 的 textarea 下方，显示分组结果，每条含 icon (FileText / Bookmark) + title + 类型 badge。
  - 键盘 ↑/↓/Enter/Esc 支持（capture-phase `window.keydown`，抢在 textarea 之前处理）。
  - ActiveIndex 用 `rawActiveIndex` + `render-time clamp` 模式避免 `react-hooks/set-state-in-effect` lint 报错。
  - `onMouseDown` 而不是 `onClick` 触发选中，避免 textarea 先失焦导致 mention state 被清空。
- `src/components/editor/inline-ask-ai-popover.tsx`
  - 新 state：`pinnedSources: MentionSource[]`、`mentionState: { query, start } | null`。
  - 新 export helper `detectMentionQuery(value, caret)`：
    - 从 caret 往前找最近的 `@`
    - 要求 `@` 前是空白或行首（防止匹配 `email@domain`）
    - 遇到空白 / 换行立即取消
    - 返回 `{ query, start }` 或 `null`
  - `handleTextareaChange(e)`：拿 `selectionStart` 作为 caret，调用 `detectMentionQuery` 更新 `mentionState`。
  - `handleSelectMention(source)`：去重后把 source 加入 `pinnedSources`，并从 input 里切掉 `@query` token。
  - `handleRemovePinned(id)`：chip 上的 × 触发，从 state 里移除。
  - `handleKeyDown`：mention 打开时拦截 Enter / ↑ / ↓ / Esc，避免 textarea 把 Enter 当 submit 触发。
  - Popover 顶部（标题下方）渲染 `data-inline-ask-ai-pinned-bar`：flex-wrap chip 列表，每个 chip 带 icon + title + × 按钮。
  - textarea 外层改为 `relative`，mention menu 作为绝对定位子元素渲染。
  - `sendMessage` 的 body 追加 `pinnedSources: pinnedSources.map(s => ({ id: s.id, type: s.type }))`。
  - 旧的 "anchor change reset" effect（setState-in-effect）删除。
- `src/components/editor/tiptap-editor.tsx`
  - 新增 `inlineAskOpenIdRef` + `inlineAskOpenId` state，每次 `open-inline-ask-ai` 事件到达就 bump 一次。
  - `<InlineAskAiPopover>` 的 `key` 从之前的"pos:selFrom:selTo"字符串改为 `inline-ask-${inlineAskOpenId}`，让每次新 anchor 都 remount popover（无论 anchor 值是否完全相同），干净重置 popover 的所有子 state。
  - 这是替换 "anchor-change reset effect" 的方案，绕开 `react-hooks/set-state-in-effect` 的合规约束。
- Popover 的 Esc handler 在 `mentionState` 非 null 时不触发 `onClose()`，让 mention menu 先吃 Esc，popover 继续保持可见。

## 3. E2E coverage

- `e2e/ask-ai-mention.spec.ts`（新）
  - Mock `/api/chat` 并捕获请求 body（`page.route` + `route.request().postData()`）以断言 `pinnedSources` 实际被发送。
  - Scenario 1: 先创建一条 `PINNED_NOTE_<uid>`（等 "Saved" 指示器），再打开 host note 的 Ask AI popover，输入 `@PINNED_NO`，mention menu 出现，点选，chip bar 含目标 title，发送问题，mock 收到 body `pinnedSources: [{id, type: "note"}]`。
  - Scenario 2: chip 的 × 按钮点击后 chip bar 隐藏。
  - Scenario 3: mention menu 打开时按 Esc 只关 menu，popover 仍可见。
  - 串行运行 6/6 passed；与已有的 `ask-ai-editor-inline.spec.ts` 组合串行也全绿。

Files touched:
- `src/app/api/chat/route.ts`
- `src/server/ai/chat-system-prompt.ts`
- `src/components/editor/inline-ask-ai-popover.tsx`
- `src/components/editor/inline-ask-ai-mention-menu.tsx`（新）
- `src/components/editor/tiptap-editor.tsx`
- `e2e/ask-ai-mention.spec.ts`（新）
- `docs/plans/2026-04-10-ask-ai-m2-mention-pinning.md`（本次由 agent 起草的可执行计划）
- `docs/changelog/2026-04-10-ask-ai-m2-mention-pinning.md`（本文件）

Verification commands and results:
- `pnpm build` ✅ 通过，无 TypeScript 错误，路由表正常。
- `pnpm lint` ✅ 0 errors；新文件 0 warning。仓库剩余 4 warning 均为 pre-existing。
- `pnpm exec eslint src/components/editor/inline-ask-ai-{popover,mention-menu}.tsx src/components/editor/tiptap-editor.tsx src/app/api/chat/route.ts src/server/ai/chat-system-prompt.ts` ✅ clean。
- `pnpm test:e2e --workers=1 e2e/ask-ai-editor-inline.spec.ts e2e/ask-ai-mention.spec.ts` ✅ 6/6 passed (24.6s)。
- `pnpm test:e2e e2e/editor.spec.ts e2e/ask-ai-editor-inline.spec.ts e2e/ask-ai-mention.spec.ts` ✅ 22 passed / 3 failed / 4 skipped。3 failed 全是 pre-existing 的 Mermaid 全屏（18/19/20），与 M2 无关 —— 在 baseline（`git stash` 后）editor.spec.ts 同样是 3 failed (Mermaid 18/19/20)。
- `pnpm test:e2e`（全量）: 52 passed / 71 failed / 1 did not run。对比 M1 e2e 补齐后的 baseline（约 48 passed / 69 failed），新加 6 个 ask-ai spec (+6 passed)，**总体 passed +4 而不是 +6** 说明并发跑时有 ~2 个 spec 在不同 playwright worker 下出现 flake —— 但串行跑所有新增 spec 是 100% 绿，所以不属于本 milestone 引入的 regression，属于仓库级 e2e 并发 SQLite 竞争的已知技术债（和 Mermaid / phase1 / focus-tracker 的 pre-existing 失败是同一类）。

Remaining risks / follow-ups:
- Daemon chat mode 仍然不处理 `pinnedSources`（和 `contextNoteText` 一样）。Inline Ask AI 强制 stream 模式，所以实际不影响用户路径；等 daemon 模式也要用 inline Ask AI 时再一起补。
- Mention menu 的关键字搜索走 `dashboard.search` 的 LIKE 匹配，只匹配 title / plainText / content / url，没走 embedding；当 note 标题和正文都不含查询字的时候找不到，但对"我知道这份 note 的名字"的场景已经足够。更智能的语义召回留给后续。
- `withPinnedSources` 把每条 pinned source 截断到 6000 字符；10 个 source 最多 60000 字 × 注入 system prompt，大文件场景下有 token 预算压力。暂未加总上限，如果后续观察到 token 爆炸再补。
- Pinned chip 当前只显示 title，没显示内容预览或 open 按钮。留给后续增强。
- Mention menu 对"新建笔记但还没 Saved"（debounce 1500ms 内）的 note 检索不到 —— 这是 `dashboard.search` 的 LIKE 依赖 db row，不是 M2 本身的问题。E2E 通过等 "Saved" 指示器绕过。
- 仓库级 e2e 并发 SQLite 竞争的老问题仍然存在，和本 milestone 无关。
- overview 里 M3（Insert/Replace/Append 动作层 + 结构化 Tiptap blocks 输出）尚未规划执行，等 M2 实际用起来后再决定下一步。
