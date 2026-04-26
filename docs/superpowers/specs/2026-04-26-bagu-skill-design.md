# 八股文 Skill — Claude Code skill backed by knosi MCP

**Status:** Draft
**Author:** Claude (Opus 4.7) with user
**Date:** 2026-04-26

---

## Background

User is studying LLM applications and backend systems. Their preferred study method is interview-style Q&A ("八股文"). They want a frictionless workflow where:

- They tell Claude Code a topic (e.g. "整理八股 RAG") **or** paste a question list (text or screenshot from RedNote / blogs / etc.)
- Claude generates expert-level Q+A cards
- Cards are written automatically to their personal knosi knowledge base
- Browsing happens in the existing knosi web UI (no new web feature needed)

The user explicitly rejected building this as a knosi web feature. The deliverable is a **Claude Code skill** plus a small backend extension to make MCP routing flexible enough to support it.

The knosi project (`D:\repos\knosi`) already has:

- A folders system (`folders` table, `foldersRouter` with create/list/etc.)
- Notes system (`notes` table) with TipTap content
- A knosi MCP server registered with `save_to_knosi`, `search_knowledge`, `list_recent_knowledge`, `get_knowledge_item`
- An "AI Inbox" auto-resolved folder used as the default sink for `save_to_knosi`
- Embeddings + hybrid RAG pipeline already running over notes

**Key constraint discovered during design**: the current `save_to_knosi` MCP tool routes every saved note into the AI Inbox folder via `resolveOrCreateAiInboxFolder`. Callers cannot target an arbitrary folder. This blocks the user's "auto-file into a 八股文 folder" requirement and is the reason this design has two sub-projects.

---

## Decision Summary

| Topic | Decision |
|------|------|
| Form factor | Claude Code skill (not a knosi web feature) |
| Skill location | `~/.claude/skills/bagu/SKILL.md` (global, not project-scoped) |
| Input modes | (a) topic-driven generation, (b) pasted question list — text or image |
| Image handling | Claude's built-in vision; no external OCR |
| Quality bar | Senior-engineer voice; no fluff; surface "what an interviewer would push on next" |
| Output granularity | One note per question |
| Storage location | A fixed top-level knosi folder named `八股文` |
| Sub-folders | None. Browsing is organized by tags, not nested folders |
| Tags | LLM-generated, Chinese, per-note (e.g. `LLM应用`, `RAG`, `向量检索`) |
| Dedup | Not done. Duplicates are accepted; user can manually delete if desired |
| Default batch size | 10 questions per topic-driven invocation; unlimited for pasted lists |
| Trigger | Natural-language phrases like "整理八股 X" / "八股 X" / "把这些八股整理一下" — no slash command |
| Note template | Six-section interview style (see §5) |
| MCP backend change | Extend `save_to_knosi` with optional `folder: string` parameter; backward compatible |
| Deployment | Push to `main` triggers Hetzner deploy automatically (project convention) |

---

## Project Decomposition

This work splits into two ordered deliverables. Sub-project A must ship first because the skill depends on the new MCP capability.

1. **Sub-project A — knosi MCP folder extension** (backend change in `D:\repos\knosi`)
2. **Sub-project B — 八股文 skill** (skill file at `~/.claude/skills/bagu/SKILL.md`)

---

## Sub-project A: knosi MCP Folder Extension

### Goal

Allow MCP callers to direct a saved note to a named folder under the user's root, instead of always writing into the AI Inbox.

### Interface change

Add an optional `folder` field to the `save_to_knosi` MCP tool input:

```ts
{
  sourceApp: string,            // existing, required
  messages: Array<{role, content}>, // existing, required
  title?: string,               // existing
  capturedAtLabel?: string,     // existing
  sourceMeta?: object,          // existing
  folder?: string               // NEW: folder name. omit/empty -> AI Inbox (legacy behaviour)
}
```

### Backend behaviour

1. If `folder` is omitted or empty string → existing behaviour (`resolveOrCreateAiInboxFolder` → AI Inbox).
2. If `folder` is provided → call new helper `resolveOrCreateNamedFolder(userId, name)` which:
   - Looks up `(userId, name=name, parentId is null)` in the `folders` table.
   - Returns the existing id if found.
   - Otherwise inserts a new top-level folder with `name`, `parentId = null`, computed `sortOrder = max+1`, no icon.
   - Reuses the existing duplicate-name suffix logic from `foldersRouter.create` only if a real race occurs (rare — single-user writes).

### Files touched

| File | Change |
|------|------|
| `src/server/integrations/mcp-tools.ts` | Add `folder` to `save_to_knosi` input schema; pass through to `captureAiNote` |
| `src/server/integrations/ai-capture.ts` | `AiCaptureInput` gets optional `folder?: string`; folder resolution branches on whether `folder` is set |
| `src/server/integrations/ai-inbox.ts` (or sibling new file) | Add `resolveOrCreateNamedFolder(userId, name)` helper; export from same module so capture deps stay simple |
| `src/server/integrations/ai-capture.test.mjs` | Cover three cases (see §Testing) |

### Behavioural guarantees

- **Backward compat**: existing callers (the public `save_to_knosi` MCP, internal users) that don't set `folder` see no change.
- **Single-user safety**: a knosi instance is per-user; concurrent writes to "create same folder" from one user are essentially impossible from this MCP path.
- **No nested folder support in V1**: `folder` is a flat top-level name. If users want nested later, it becomes `parentPath` — out of scope here.

### Validation

- `folder` is trimmed; empty after trim → treat as omitted.
- Length ≤ 200 (matches the existing `foldersRouter.create` zod constraint).
- No path separators interpreted (`"a/b"` is a literal name, not a path).

---

## Sub-project B: 八股文 Skill

### File layout

```
~/.claude/skills/bagu/
└── SKILL.md
```

Single-file skill. No external scripts, no per-language helpers. The behaviour is encoded in the SKILL.md prompt and executed by the running Claude.

### YAML frontmatter

```yaml
---
name: bagu
description: Use when the user wants to organize "八股文" (interview-style Q&A) for LLM applications, backend, or system design — either by topic ("整理八股 RAG") or by pasting a question list (text or screenshot). Generates senior-engineer level answers and writes one knosi note per question into the 八股文 folder via knosi MCP.
---
```

(Single-line description — superpowers skill convention; multi-line block scalars not always parsed reliably across CC versions.)

### Behaviour spec (encoded in SKILL.md body)

#### Detect mode

- **Topic mode (P1)**: user names a topic without supplying any candidate questions. Examples: `整理八股 RAG`, `给我来 10 道大模型应用八股`, `八股 后端缓存`.
- **List mode (P2)**: user supplies candidate questions explicitly — pasted text, attached image(s), or a mix.

If the topic is too broad to generate good questions (e.g. "整理八股 后端"), Claude must ask one clarifying question before generating. If the user's intent is ambiguous between topic mode and list mode, Claude asks.

#### P1 — Topic mode flow

1. Confirm the topic understanding in one sentence ("好，整理 RAG 方向，生成 10 道资深工程师视角的题。").
2. Generate N questions (default `N = 10`; user can override with "20 道" / "5 道" / etc.).
3. For each question, produce the full 6-section answer (see §5) plus 2–5 Chinese tags.
4. Write each question via `mcp__0b273582-...__save_to_knosi` with:
   - `folder: "八股文"`
   - `title: <question text>`
   - `messages: [{ role: "assistant", content: <markdown body> }]`
   - `sourceApp: "bagu-skill"`
   - `sourceMeta: { tags: [...], topic: "<input topic>", category: "bagu", template: "v1" }`
5. After the loop, report the count, list the titles, and show the most common tags.

#### P2 — List mode flow

1. Read all input. For images, use built-in vision to extract text; merge text and image-derived questions into one candidate list.
2. Show the user the parsed list ("以下是我读出来的 12 道题，确认/修改/删减"). This is the **only** interactive checkpoint.
3. After confirmation, run the same write loop as P1, one question at a time.
4. Final report identical to P1.

#### Vision handling

- Built-in multimodal — no `tesseract` or external OCR.
- For unreadable text or handwritten content, list those items separately and ask the user to retype them rather than guessing.
- Multi-question screenshots are split into individual questions.

#### Senior-engineer voice (must do)

- Lead with the load-bearing answer, not boilerplate.
- "常见追问" must reflect what an actual interviewer would ask after the candidate's first answer — not generic follow-ups.
- "易错点" must list things a junior would get wrong but a senior would catch.
- Avoid the LLM-cliché preamble ("这是一个很好的问题…", "需要分几个层面来回答…"). Just answer.

#### Error / partial-failure handling

- If `save_to_knosi` fails for one question, log it locally, continue with the rest. Final report includes a `failed` section with the question text and error.
- If MCP isn't reachable at all, abort early and tell the user — don't pretend writes succeeded.

---

## Note Template (locked)

```markdown
# {question}

> {one-liner answer, ≤30 chars}

## 核心原理
{200–400 字，讲透 why & how；可拆段落但不必硬塞标题}

## 代码 / 示意
{若适用才输出；否则整段省略}

```{lang}
{code}
```

## 常见追问
- Q: {follow-up 1}
  A: {short answer}
- Q: {follow-up 2}
  A: {short answer}
{3–5 条；面试官真实会顺着问的方向}

## 易错点 / 反直觉
- {senior-only insight 1}
- {senior-only insight 2}

## 何时用 / 何时不用
- ✅ 适用：...
- ❌ 不适用：...
```

Empty/non-applicable sections are dropped entirely (no empty headings).

---

## Error Handling Matrix

| Scenario | Behaviour |
|----------|-----------|
| MCP write fails for one question | Continue loop; report failures at end |
| MCP unreachable on first call | Abort; tell user; do not retry silently |
| Vision read ambiguous | Surface in P2 confirmation step; don't guess |
| User topic too broad ("八股 后端") | Ask one clarifying question before generating |
| Folder doesn't exist | Backend creates it on first write (sub-project A) |
| Concurrent folder creation | Backend's get-or-create handles it; "(2)" suffix only as last-resort fallback |

---

## Testing Strategy

### Sub-project A (automated)

Add three cases to `src/server/integrations/ai-capture.test.mjs`:

1. **No folder param** — note lands in AI Inbox (regression).
2. **Folder param, folder doesn't exist** — folder is created, note lands inside it.
3. **Folder param, folder exists** — existing folder is reused, note lands inside it.

Run the project's standard verification chain: `pnpm build && pnpm lint && pnpm test:e2e`.

### Sub-project B (manual smoke)

Skill is a prompt; not unit-testable. Three manual smoke tests after deploy:

1. `整理八股 RAG` → 10 notes appear in knosi `八股文` folder, each follows the template.
2. Paste 5 questions in text → all 5 land correctly with reasonable tags.
3. Paste a screenshot of an interview question list → vision extraction works, user confirmation step appears, notes land correctly.

A passing smoke run is the bar for "skill ready". No automated CI for the skill itself.

---

## Out of Scope (YAGNI)

- ❌ Spaced repetition / SRS scheduling
- ❌ Dedup (semantic or otherwise)
- ❌ New web UI in knosi (existing notes UI handles browsing)
- ❌ Sub-folders under 八股文 (tags do the job)
- ❌ Auto-export of cards to PDF / flashcard apps (Anki etc.)
- ❌ The skill writing code into the repo — it only writes notes via MCP
- ❌ Generating questions in English; default is Chinese throughout

---

## Open Questions / Risks

- **Risk: knosi MCP auth in skill context.** The skill calls the MCP tools directly via the `mcp__0b273582-...` namespace. Verify these tool names resolve in the user's installed environment before testing — they are present in this conversation but the skill must work in fresh sessions too.
- **Risk: MCP folder name in non-Latin chars.** "八股文" must round-trip cleanly through MCP JSON. Both `mcp-tools.ts` schema and the database column are utf-8; expected to work, but the test suite must include a Chinese folder name case.
- **Risk: cost / latency on big batches.** 10 well-written senior-level answers is a non-trivial Claude generation. Acceptable for now; if it grows painful, add a "draft mode" later.
- **Risk: skill triggers too aggressively.** The description must be tight enough that "what's a good interview question for X?" doesn't auto-trigger generation when the user only wanted one example. The frontmatter description bias is "user wants to **organize/store**, not just discuss".
- **Risk: oversized batches.** A pasted list of 100 questions would trigger 100 expert-level generations + 100 MCP writes. V1 has no hard cap, but the skill should warn the user before processing if a list looks ≥ 30 items: "这批有 N 道，是否分批？" — single confirmation, then proceed if they say go.

---

## Implementation Order

1. Branch off `main` for sub-project A.
2. Implement `resolveOrCreateNamedFolder` + plumb `folder` param through.
3. Add the three test cases. Make them pass.
4. Run `pnpm build && pnpm lint && pnpm test:e2e` — all must pass.
5. Commit + push (auto-deploys to Hetzner). Verify deployment health.
6. Once deployed, write `~/.claude/skills/bagu/SKILL.md`.
7. Smoke-test the three flows manually against production knosi.
8. If smoke passes, the feature is shipped.
