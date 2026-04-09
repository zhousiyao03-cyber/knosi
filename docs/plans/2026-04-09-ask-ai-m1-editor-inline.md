# Ask AI M1 — Editor Inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Ask AI 从 `/ask` 全页带进 Tiptap 编辑器：用户在任意 note 内可以通过 (a) 空行 `/ai` slash 命令 和 (b) 选中文本后的 bubble toolbar "Ask AI" 按钮两种方式唤起 AI，答案以 block 形式直接写入当前 note。

**Architecture:**
- 新建一个**纯 UI 组件** `<InlineAskAiPopover>`：接收 `editor` 实例 + 锚点坐标 + 可选 `selectedText`，内部自管 composer 输入态和流式状态，复用已有 `/api/chat`（`sourceScope=direct`）。
- Slash 命令添加 `ask-ai` 项，打开 popover 锚定到光标行。
- Bubble toolbar 新增 "Ask AI" 按钮，打开 popover 锚定到选区末尾，把选中文本作为 `selectedText` 传入（变成改写模式）。
- 答案通过 `editor.chain().insertContentAt(pos, aiTextToTiptapJson(text))` 写入，统一一个 `ai-text-to-tiptap.ts` 工具函数做纯文本 → Tiptap doc JSON 的转换（复用 `ask/page.tsx:buildNoteDocument` 的思路，抽取公共部分）。
- 请求 body 增加可选 `contextNoteText` 字段，后端将其作为 system prompt 的"当前 note 上下文"段落拼入；为了最小侵入，直接在 `chat-system-prompt.ts` 的 `buildSystemPrompt` 加一个可选参数。

**Tech Stack:** Next.js 16, React 19, Tiptap v3, `@ai-sdk/react` (stream mode), tRPC v11, zod/v4, Tailwind.

**Scope boundaries（本 Milestone 不做）：**
- ❌ @mention 引用（M2）
- ❌ Insert / Replace / Append 高级动作（M3，本期只做"插入到光标处"这一种）
- ❌ 多模态（M4）
- ❌ Inline citation（M5）
- ❌ Daemon 模式兼容（本期只走 stream 模式的 `/api/chat`；daemon 模式下退化为"直接答完再一次性插入"）

---

## File Structure

### Create
- `src/components/editor/inline-ask-ai-popover.tsx` — 新组件，弹出在光标附近的 mini composer，负责输入、发送、流式渲染、插入。~280 行。
- `src/lib/ai-text-to-tiptap.ts` — 纯函数 `aiTextToTiptapJson(text: string): JSONContent[]`，把换行分段的 AI 文本转成 Tiptap node JSON 数组，支持 `# ` 标题、`- ` 列表、``` 代码块最基础三种 markdown 语法。~120 行。
- `e2e/ask-ai-editor-inline.spec.ts` — 覆盖 slash `/ai` 流、bubble toolbar 改写流两个核心路径的 E2E。

### Modify
- `src/components/editor/editor-commands.ts` — 在 `createEditorCommandGroups` 中新增 `ask-ai` 命令项（blocks 分组内），`run` 触发一个 editor custom event `open-inline-ask-ai`。
- `src/components/editor/tiptap-editor.tsx` — 挂载 `<InlineAskAiPopover>`，监听 `open-inline-ask-ai` 事件，记录锚点 pos。~第 577 行前后（`createEditorCommandGroups` 调用处）同文件末尾渲染树。
- `src/components/editor/bubble-toolbar.tsx` — 新增 "Ask AI" 按钮（位置：bold/italic 左边第一个），点击派发 `open-inline-ask-ai` 事件并携带当前选区文本。
- `src/server/ai/chat-system-prompt.ts` — `buildSystemPrompt` 增加可选 `contextNoteText?: string` 参数；如存在，在 system prompt 末尾拼一段 "Current note context:\n{text}"。
- `src/app/api/chat/route.ts` — `chatInputSchema` 增加 `contextNoteText: z.string().optional()`；透传给 `buildSystemPrompt`。
- `docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md` — Milestone 留档。
- `README.md` — 如有进度 checklist，勾上 M1。

---

## Task 1: `aiTextToTiptapJson` utility + unit test

**Files:**
- Create: `src/lib/ai-text-to-tiptap.ts`
- Create: `src/lib/__tests__/ai-text-to-tiptap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/ai-text-to-tiptap.test.ts
import { describe, it, expect } from "vitest";
import { aiTextToTiptapJson } from "@/lib/ai-text-to-tiptap";

describe("aiTextToTiptapJson", () => {
  it("turns plain paragraphs into paragraph nodes", () => {
    const out = aiTextToTiptapJson("Hello world\n\nSecond line");
    expect(out).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
    ]);
  });

  it("recognizes # heading", () => {
    const out = aiTextToTiptapJson("# Title\nbody");
    expect(out[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Title" }],
    });
  });

  it("recognizes - bullet list items", () => {
    const out = aiTextToTiptapJson("- one\n- two");
    expect(out).toEqual([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "one" }] },
            ],
          },
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "two" }] },
            ],
          },
        ],
      },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(aiTextToTiptapJson("")).toEqual([]);
    expect(aiTextToTiptapJson("   \n  ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/ai-text-to-tiptap.test.ts`
Expected: FAIL — module not found.

> **Note:** 如果项目没有 `vitest`，这一步改为只写源文件 + 在 `e2e/ask-ai-editor-inline.spec.ts` 中覆盖。先查 `package.json`：`grep -q vitest package.json && echo yes`。
> - 有 vitest → 按本步进行
> - 没 vitest → 跳过 Step 1-2，直接去 Step 3 写源文件，测试留给 Task 7 E2E

- [ ] **Step 3: Implement minimal version**

```ts
// src/lib/ai-text-to-tiptap.ts
import type { JSONContent } from "@tiptap/react";

/**
 * Convert AI plain text output into a Tiptap JSON content array.
 * Supports basic Markdown:
 *  - `# ` / `## ` ... `###### ` headings
 *  - `- ` bullet list items (contiguous lines merged into one bulletList)
 *  - ```` ``` ```` fenced code blocks
 *  - blank-line separated paragraphs
 * Falls back to paragraph for anything unrecognized.
 */
export function aiTextToTiptapJson(input: string): JSONContent[] {
  const text = input ?? "";
  if (!text.trim()) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: JSONContent[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: buf.join("\n") }],
      });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      out.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
      });
      i++;
      continue;
    }

    // Bullet list (contiguous `- ` lines)
    if (/^-\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^-\s+/, "");
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: itemText }] },
          ],
        });
        i++;
      }
      out.push({ type: "bulletList", content: items });
      continue;
    }

    // Blank line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    out.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
    i++;
  }

  return out;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm vitest run src/lib/__tests__/ai-text-to-tiptap.test.ts` (if vitest available)
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-text-to-tiptap.ts src/lib/__tests__/ai-text-to-tiptap.test.ts
git commit -m "feat(ask-ai): add aiTextToTiptapJson utility for inline insertion"
```

---

## Task 2: Backend — accept `contextNoteText` in `/api/chat`

**Files:**
- Modify: `src/app/api/chat/route.ts:23-27` (schema), `:124` (buildSystemPrompt call)
- Modify: `src/server/ai/chat-system-prompt.ts` (`buildSystemPrompt` signature)

- [ ] **Step 1: Extend `buildSystemPrompt` to accept optional note context**

Open `src/server/ai/chat-system-prompt.ts` and find `buildSystemPrompt`. Current signature is `buildSystemPrompt(context: RetrievedKnowledgeItem[], sourceScope: AskAiSourceScope)`. Change to:

```ts
export function buildSystemPrompt(
  context: RetrievedKnowledgeItem[],
  sourceScope: AskAiSourceScope,
  options?: { contextNoteText?: string }
): string {
  // ... existing body stays the same ...
  // At the very end, just before the final `return`:
  const base = /* existing computed prompt */;
  const noteCtx = options?.contextNoteText?.trim();
  if (noteCtx) {
    return (
      base +
      `\n\n---\n` +
      `The user is currently editing a note. Here is the CURRENT NOTE CONTENT for context (use it to answer "this note", "this page", "the text above" references; do not repeat it back unless asked):\n\n` +
      noteCtx.slice(0, 8000)
    );
  }
  return base;
}
```

> **Note:** 保留对 `base` 的实际返回值不变；上面的伪代码只展示额外拼接。打开文件按实际结构改。

- [ ] **Step 2: Extend the request schema in `route.ts`**

```ts
// src/app/api/chat/route.ts
const chatInputSchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()),
  sourceScope: z.enum(ASK_AI_SOURCE_SCOPES).optional(),
  contextNoteText: z.string().max(32_000).optional(),
});
```

- [ ] **Step 3: Pass it through to `buildSystemPrompt`**

Find the call site at `src/app/api/chat/route.ts:124`:

```ts
// Before
system: buildSystemPrompt(context, sourceScope),

// After
system: buildSystemPrompt(context, sourceScope, {
  contextNoteText: parsed.data.contextNoteText,
}),
```

- [ ] **Step 4: Handle daemon branch too**

At `src/app/api/chat/route.ts:72-80` where daemon branch calls `enqueueChatTask`, pass `contextNoteText` into the task body as well (keep it simple: add it to `enqueueChatTask` args if the function supports it, otherwise fall through silently — the daemon path will just ignore it for M1 and we document the gap in changelog).

Quick check: open `src/server/ai/chat-enqueue.ts`. If `enqueueChatTask` doesn't accept `contextNoteText`, **do not extend it in M1** — instead add a comment `// TODO(M1-followup): daemon mode currently ignores contextNoteText` above the daemon branch call.

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors related to the modified files.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts src/server/ai/chat-system-prompt.ts
git commit -m "feat(ask-ai): plumb contextNoteText through /api/chat for inline usage"
```

---

## Task 3: `InlineAskAiPopover` component (initial shell)

**Files:**
- Create: `src/components/editor/inline-ask-ai-popover.tsx`

- [ ] **Step 1: Create component skeleton**

```tsx
// src/components/editor/inline-ask-ai-popover.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Loader2, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiTextToTiptapJson } from "@/lib/ai-text-to-tiptap";

const transport = new TextStreamChatTransport({ api: "/api/chat" });

export interface InlineAskAiAnchor {
  /** Document position where the popover is anchored (insertion point). */
  pos: number;
  /** Viewport coords for positioning the popover. */
  top: number;
  left: number;
  /** Optional: the selected text that should become the "rewrite target". */
  selectedText?: string;
  /** Optional: selection range (for replace action in later milestones). */
  selectionFrom?: number;
  selectionTo?: number;
}

interface Props {
  editor: Editor;
  anchor: InlineAskAiAnchor | null;
  onClose: () => void;
  /** Full plain text of the current note for system-prompt context. */
  noteText: string;
}

export function InlineAskAiPopover({ editor, anchor, onClose, noteText }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant
    ? lastAssistant.parts
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("")
    : "";

  // Reset state whenever a new anchor opens the popover.
  useEffect(() => {
    if (anchor) {
      setInput("");
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [anchor, setMessages]);

  // Close on Escape / click outside.
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  const isRewrite = Boolean(anchor.selectedText);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const finalPrompt = isRewrite
      ? `Rewrite the following text according to the instruction "${trimmed}". Output only the rewritten text, no preamble.\n\n---\n${anchor.selectedText}`
      : trimmed;

    sendMessage(
      { text: finalPrompt },
      {
        body: {
          sourceScope: "direct",
          contextNoteText: noteText.slice(0, 8000),
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInsert = () => {
    if (!lastAssistantText.trim()) return;
    const json = aiTextToTiptapJson(lastAssistantText);
    if (json.length === 0) return;

    if (isRewrite && anchor.selectionFrom != null && anchor.selectionTo != null) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: anchor.selectionFrom, to: anchor.selectionTo })
        .insertContentAt(anchor.selectionFrom, json)
        .run();
    } else {
      editor.chain().focus().insertContentAt(anchor.pos, json).run();
    }
    onClose();
  };

  const handleDiscard = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[min(520px,calc(100vw-32px))] rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-950"
      style={{ top: anchor.top, left: anchor.left }}
      data-inline-ask-ai
    >
      <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <Sparkles size={14} />
        {isRewrite ? "改写选中文本" : "Ask AI"}
      </div>

      <div className="px-3 py-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRewrite ? "想怎么改写？（例如：更简洁、翻译为英文）" : "问点什么，或让 AI 帮你写..."}
          rows={2}
          disabled={isLoading}
          className="w-full resize-none border-none bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400 dark:text-stone-100"
        />
      </div>

      {(lastAssistantText || isLoading) && (
        <div className="max-h-60 overflow-y-auto border-t border-stone-100 px-3 py-3 text-sm leading-6 text-stone-800 dark:border-stone-800 dark:text-stone-100">
          {lastAssistantText ? (
            <div className="whitespace-pre-wrap">{lastAssistantText}</div>
          ) : (
            <div className="flex items-center gap-2 text-stone-500">
              <Loader2 size={14} className="animate-spin" />
              正在思考...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-red-100 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
          出错了：{error.message}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
        <div className="text-[11px] text-stone-400">
          Enter 发送 · Esc 关闭
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <button
              type="button"
              onClick={() => stop()}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-900"
            >
              <Square size={12} /> 停止
            </button>
          )}
          {lastAssistantText && !isLoading && (
            <>
              <button
                type="button"
                onClick={handleDiscard}
                className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-900"
              >
                丢弃
              </button>
              <button
                type="button"
                onClick={handleInsert}
                className={cn(
                  "rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700",
                  "dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300"
                )}
              >
                {isRewrite ? "替换" : "插入"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors. Fix any import path issues.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/inline-ask-ai-popover.tsx
git commit -m "feat(ask-ai): add InlineAskAiPopover component (stream + insert)"
```

---

## Task 4: Wire `InlineAskAiPopover` into `tiptap-editor.tsx`

**Files:**
- Modify: `src/components/editor/tiptap-editor.tsx` (imports at top, state inside component body, event listener, render tree at bottom)

- [ ] **Step 1: Add imports**

Near the existing imports at the top of `tiptap-editor.tsx`:

```tsx
import {
  InlineAskAiPopover,
  type InlineAskAiAnchor,
} from "./inline-ask-ai-popover";
```

- [ ] **Step 2: Add anchor state inside the component**

Inside the main editor component (look for the line that calls `createEditorCommandGroups` at around L577 and scroll up to find `useState` calls). Add:

```tsx
const [inlineAskAnchor, setInlineAskAnchor] = useState<InlineAskAiAnchor | null>(null);
```

- [ ] **Step 3: Add event listener hook**

Below the state declaration (or wherever other `useEffect` hooks for editor events live), add:

```tsx
useEffect(() => {
  if (!editor) return;
  const onOpen = (event: Event) => {
    const detail = (event as CustomEvent<InlineAskAiAnchor>).detail;
    setInlineAskAnchor(detail);
  };
  window.addEventListener("open-inline-ask-ai", onOpen as EventListener);
  return () => {
    window.removeEventListener("open-inline-ask-ai", onOpen as EventListener);
  };
}, [editor]);
```

- [ ] **Step 4: Render the popover**

Find the JSX return of the editor component (towards the end of the file). After the existing `<BubbleToolbar />` / similar floating UI, add:

```tsx
{editor && inlineAskAnchor && (
  <InlineAskAiPopover
    editor={editor}
    anchor={inlineAskAnchor}
    noteText={editor.getText()}
    onClose={() => setInlineAskAnchor(null)}
  />
)}
```

> **Note:** `editor.getText()` returns the whole document's plain text — cheap (O(n)) and fine for M1. We'll optimize later if needed.

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/tiptap-editor.tsx
git commit -m "feat(ask-ai): mount InlineAskAiPopover inside Tiptap editor"
```

---

## Task 5: Slash command `/ai` → open popover

**Files:**
- Modify: `src/components/editor/editor-commands.ts` (add item inside `blocks` group)

- [ ] **Step 1: Import Sparkles icon**

At the top of `editor-commands.ts`, add `Sparkles` to the lucide-react imports.

```ts
import { /* ...existing... */ Sparkles } from "lucide-react";
```

- [ ] **Step 2: Add `ask-ai` command item**

Find the `blocks` group in `createEditorCommandGroups` (contains items like `code`, `mermaid`, `callout`, `toc`, `horizontal-rule`). Insert **at the top of the `items` array**:

```ts
{
  id: "ask-ai",
  title: "Ask AI",
  description: "用 AI 帮你写或回答",
  keywords: ["ai", "ask", "gpt", "claude", "问 ai", "人工智能"],
  icon: Sparkles,
  shortcutHint: "/ai",
  run: (editor) => {
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    window.dispatchEvent(
      new CustomEvent("open-inline-ask-ai", {
        detail: {
          pos: from,
          top: coords.bottom + 6,
          left: coords.left,
        },
      })
    );
  },
  transformable: false,
},
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test (dev server)**

Run: `pnpm dev` in a separate terminal. Open any note, type `/ai`, select the command, verify popover appears below the caret. Type "say hi", press Enter, verify stream comes back, click "插入", verify text lands in the editor.

> Record the result: ✅ works / ❌ describe failure. If ❌, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editor-commands.ts
git commit -m "feat(ask-ai): add /ai slash command to open inline popover"
```

---

## Task 6: Bubble toolbar "Ask AI" button (rewrite mode)

**Files:**
- Modify: `src/components/editor/bubble-toolbar.tsx`

- [ ] **Step 1: Import Sparkles**

Add `Sparkles` to the lucide-react import at top of `bubble-toolbar.tsx`.

- [ ] **Step 2: Add the button**

Find the `<BubbleButton>` chain around L141 (first bold button). Insert **before** it:

```tsx
<BubbleButton
  onClick={() => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    const coords = editor.view.coordsAtPos(to);
    window.dispatchEvent(
      new CustomEvent("open-inline-ask-ai", {
        detail: {
          pos: to,
          top: coords.bottom + 6,
          left: coords.left,
          selectedText,
          selectionFrom: from,
          selectionTo: to,
        },
      })
    );
  }}
  title="Ask AI"
>
  <Sparkles size={iconSize} className="text-gray-300" />
</BubbleButton>

{/* Existing divider if any; add a small separator */}
<div className="mx-0.5 h-4 w-px bg-stone-700/60" />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

With dev server running: open a note, type "The quick brown fox jumps over the lazy dog", select the sentence, verify bubble toolbar shows with the new Sparkles button leftmost. Click it. In the popover, type "translate to Chinese", Enter, verify stream comes back, click "替换", verify the original sentence is replaced with Chinese.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/bubble-toolbar.tsx
git commit -m "feat(ask-ai): add Ask AI button to bubble toolbar for rewrite mode"
```

---

## Task 7: E2E test coverage

**Files:**
- Create: `e2e/ask-ai-editor-inline.spec.ts`

- [ ] **Step 1: Look at an existing spec to match patterns**

Run: `ls e2e/` and open one existing spec (e.g. `phase6.spec.ts` or whichever deals with note creation) to copy auth/setup boilerplate. The key things to steal: how the test logs in / bypasses auth, how it creates a note, how it reaches the editor.

- [ ] **Step 2: Write the spec**

```ts
// e2e/ask-ai-editor-inline.spec.ts
import { test, expect } from "@playwright/test";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Ask AI inline in editor", () => {
  test("slash /ai opens popover and inserts answer", async ({ page }) => {
    // Assumes AUTH_BYPASS=true and AI_PROVIDER set to a test-friendly provider
    // (e.g. codex in E2E env per CLAUDE.md guidance).
    const title = `ai-inline-${uid()}`;

    await page.goto("/notes");
    await page.getByRole("button", { name: /new note|新建/i }).first().click();
    await page.locator('input[placeholder*="title" i], input[placeholder*="标题"]').first().fill(title);

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.type("/ai");

    // Slash menu should show Ask AI item at top
    await expect(page.getByRole("option", { name: /ask ai/i }).first()).toBeVisible();
    await page.getByRole("option", { name: /ask ai/i }).first().click();

    // Popover visible
    const popover = page.locator("[data-inline-ask-ai]");
    await expect(popover).toBeVisible();

    await popover.locator("textarea").fill("say hello in one short sentence");
    await popover.locator("textarea").press("Enter");

    // Wait for stream to settle (insert button becomes visible)
    await expect(popover.getByRole("button", { name: /插入|insert/i })).toBeVisible({
      timeout: 30_000,
    });

    await popover.getByRole("button", { name: /插入|insert/i }).click();
    await expect(popover).not.toBeVisible();

    // Editor now contains some AI-inserted content (length grew)
    const text = await editor.innerText();
    expect(text.length).toBeGreaterThan(10);
  });

  test("bubble toolbar Ask AI replaces selection", async ({ page }) => {
    const title = `ai-rewrite-${uid()}`;
    await page.goto("/notes");
    await page.getByRole("button", { name: /new note|新建/i }).first().click();
    await page.locator('input[placeholder*="title" i], input[placeholder*="标题"]').first().fill(title);

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.type("ORIGINAL_TEXT_MARKER");

    // Select all of that text
    await page.keyboard.press("Control+A");

    // Bubble toolbar should appear with Ask AI button
    const askBtn = page.getByRole("button", { name: /ask ai/i });
    await expect(askBtn).toBeVisible();
    await askBtn.click();

    const popover = page.locator("[data-inline-ask-ai]");
    await expect(popover).toBeVisible();
    await popover.locator("textarea").fill('replace with exactly the text "REPLACED"');
    await popover.locator("textarea").press("Enter");

    await expect(popover.getByRole("button", { name: /替换|replace/i })).toBeVisible({
      timeout: 30_000,
    });
    await popover.getByRole("button", { name: /替换|replace/i }).click();

    const text = await editor.innerText();
    expect(text).not.toContain("ORIGINAL_TEXT_MARKER");
  });
});
```

- [ ] **Step 3: Run the E2E**

Run: `pnpm test:e2e e2e/ask-ai-editor-inline.spec.ts`
Expected: both tests pass.

> **If flake:** selectors may need tweaks based on your actual UI. Check `e2e/` neighbours for how existing tests target the editor and adjust. Do NOT lower the assertions; fix the selectors.

- [ ] **Step 4: Commit**

```bash
git add e2e/ask-ai-editor-inline.spec.ts
git commit -m "test(ask-ai): e2e coverage for inline slash and bubble-toolbar flows"
```

---

## Task 8: Changelog + README update

**Files:**
- Create: `docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md`
- Modify: `README.md` (if there's a roadmap checklist for Ask AI)

- [ ] **Step 1: Write the changelog entry**

```markdown
# 2026-04-09 — Ask AI M1: Editor inline

## Goal
Bring Ask AI out of the `/ask` full-page shell into the Tiptap editor, as the first Milestone of the Notion Ask AI alignment roadmap (see `docs/plans/2026-04-09-ask-ai-notion-alignment-overview.md`).

## Key changes
- New slash command `/ai` in the editor's blocks group.
- New "Ask AI" button in the bubble toolbar for rewriting selected text.
- New `<InlineAskAiPopover>` component: streaming composer anchored at the caret / selection, with Insert or Replace actions.
- New `aiTextToTiptapJson` utility: plain-text → Tiptap JSON (paragraphs, headings, bullet list, fenced code).
- `/api/chat` now accepts optional `contextNoteText`, passed through to `buildSystemPrompt` as the "current note context" segment.
- Daemon-mode path currently ignores `contextNoteText` (follow-up).

## Files touched
- src/lib/ai-text-to-tiptap.ts (new)
- src/lib/__tests__/ai-text-to-tiptap.test.ts (new, if vitest)
- src/components/editor/inline-ask-ai-popover.tsx (new)
- src/components/editor/editor-commands.ts (new /ai item)
- src/components/editor/bubble-toolbar.tsx (new Ask AI button)
- src/components/editor/tiptap-editor.tsx (mount popover, event listener)
- src/server/ai/chat-system-prompt.ts (contextNoteText plumbing)
- src/app/api/chat/route.ts (schema + passthrough)
- e2e/ask-ai-editor-inline.spec.ts (new)

## Verification
- `pnpm build` ✅
- `pnpm lint` ✅
- `pnpm test:e2e e2e/ask-ai-editor-inline.spec.ts` ✅
- Manual: /ai slash insert flow ✅
- Manual: bubble toolbar rewrite flow ✅

## Known risks / follow-ups
- Daemon chat mode does not yet honor `contextNoteText`. Document in `src/app/api/chat/route.ts` with a TODO; address when M3 (output actions) arrives since daemon + inline is a rare combo right now.
- Popover position doesn't account for viewport edges (may clip near bottom). Acceptable for M1; M3 can harden positioning.
- `editor.getText()` is called on every popover open; fine for typical notes but could be slow for 100k+ char notes.

## Next milestone
M2 — `@mention` to pin specific notes/bookmarks as hard context.
```

- [ ] **Step 2: Update README if it has an Ask AI checklist**

Grep for "Ask AI" in README.md. If there's a progress section, add or tick "M1 — Editor inline" next to the Ask AI section. If there isn't, skip — don't invent a new section for M1 alone.

- [ ] **Step 3: Commit**

```bash
git add docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md README.md
git commit -m "docs(ask-ai): changelog for M1 editor inline"
```

---

## Task 9: Full-repo verification

**Files:** (no code changes)

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: exit 0, no TypeScript errors, no build errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: exit 0, no errors. Fix any warnings that come from files touched in this milestone.

- [ ] **Step 3: E2E full run**

Run: `pnpm test:e2e`
Expected: all tests pass, including `ask-ai-editor-inline.spec.ts`.

- [ ] **Step 4: If all pass, print a short status summary to user**

Example: "M1 complete. 9 tasks, 9 commits. build ✅, lint ✅, e2e ✅. Changelog at `docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md`. Ready for M2 planning."

- [ ] **Step 5: If anything fails, stop and fix before declaring done**

No exceptions. Per project rules: "不可以声称'看起来应该没问题'就跳过验证。"

---

## Task 10: Acceptance walkthrough (equivalent of pre-qa-self-test for this web project)

**Files:** (no code changes)

**Preconditions:** Task 9 all green.

- [ ] **Step 1: Walk the two core user journeys manually**

With `pnpm dev` running and logged into a test account, walk:

1. **Slash insert flow**
   - [ ] Open an existing note
   - [ ] On a blank line type `/ai`
   - [ ] Menu shows "Ask AI" at the top of blocks group
   - [ ] Click it → popover opens below caret
   - [ ] Type "write a 3-item TODO list about planning a trip", Enter
   - [ ] Stream appears in popover
   - [ ] Click "插入"
   - [ ] Editor now contains the bulleted list at the cursor position
   - [ ] Popover closed

2. **Rewrite flow**
   - [ ] In the same note type a sentence, select it
   - [ ] Bubble toolbar appears with Sparkles "Ask AI" button first
   - [ ] Click it → popover opens, header says "改写选中文本"
   - [ ] Type "翻译为中文", Enter
   - [ ] Stream appears
   - [ ] Click "替换"
   - [ ] Original sentence is gone, Chinese translation is in its place

- [ ] **Step 2: Negative path spot check**

- [ ] Press Esc inside popover → popover closes, editor untouched
- [ ] Click outside popover while streaming → popover closes (ok if stream continues silently; acceptable for M1)
- [ ] Invalid API (e.g. set an invalid AI key temporarily): error banner shows inside popover in red; editor untouched

- [ ] **Step 3: Write a one-paragraph acceptance note appended to the M1 changelog**

Append a `## Acceptance walkthrough (2026-04-09)` section to `docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md` listing which journeys passed. Commit with:

```bash
git add docs/changelog/2026-04-09-ask-ai-m1-editor-inline.md
git commit -m "docs(ask-ai): M1 acceptance walkthrough results"
```

- [ ] **Step 4: Declare M1 done and prompt for M2**

Tell the user: "M1 shipped. Want me to write the M2 plan (@mention pinned sources) now, or take it for a spin first?"
