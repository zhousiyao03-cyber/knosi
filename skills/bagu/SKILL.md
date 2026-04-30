---
name: bagu
description: Use when the user wants to organize "八股文" (interview-style Q&A) for LLM applications, backend, system design, or any theoretical study material — either by topic ("整理八股 RAG") or by pasting a question list (text or screenshot). Generates senior-engineer level answers and writes one knosi learning card per question into the named topic via the knosi MCP `create_learning_card` tool.
---

# 八股文 Skill

Turn a topic prompt or pasted question list into senior-engineer-level Q+A cards, filed into the user's Knosi **learning module** as cards under a named topic. Browsing happens at `https://www.knosi.xyz/learn`.

## When to trigger

- User says something like 整理八股 X / 八股 X / 把这些八股整理一下 / 给我来 N 道 X 的八股
- User pastes a list of interview-style questions (text or image) and asks to organize / store them
- Bias: user wants to **organize / store**, not just discuss. If it's a single question they're asking right now, just answer — don't invoke the skill.

## Output destination

Every card is written via the knosi MCP tool **`create_learning_card`** (NOT `create_note`). Cards land in the user's learning module at `/learn/<topicId>/<noteId>`. Topic is created on first use.

Standard arguments per card:

```jsonc
{
  "topicName": "<Topic name — see §Topic naming>",
  "title": "<the question>",
  "body": "<full markdown body following the 6-section template>",
  "tags": ["<2-5 LLM-generated tags, Chinese, e.g. 'RAG', '向量检索'>"]
}
```

The MCP tool name with the user's installed namespace prefix is typically `mcp__claude_ai_Knosi__create_learning_card` (or similar `mcp__*__create_learning_card`). Use whatever your runtime exposes.

## Topic naming

- **Topic-mode** (`整理八股 RAG`): topic = the user's stated subject, in the natural form they used. `RAG` → topic `RAG`. `大模型应用` → topic `大模型应用`. `后端缓存` → topic `后端缓存`.
- **List-mode** (pasted questions): infer the topic from the questions. If ambiguous, ask the user once: "这批我归到哪个 topic？比如 'React 原理'、'浏览器渲染'。"
- One topic per invocation. If the questions clearly span multiple topics, ask the user to split.
- Topic names are reused across invocations (same topicName → same topic). Pick a stable, short name.

## Flows

### P1 — Topic mode

1. Confirm understanding in one sentence: "好，整理 RAG 方向，生成 10 道资深工程师视角的题。"
2. Generate N questions (default `N = 10`; user can override with `20 道` / `5 道`).
3. For each question, produce the full 6-section answer (see §Note template) plus 2-5 Chinese tags.
4. Call `create_learning_card` once per question with `{ topicName, title=question, body=markdown, tags }`.
5. After the loop, report the count, list the titles, and show the most common tags.

### P2 — List mode

1. Read all input. For images, use built-in vision to extract text; merge text + image-derived questions into one candidate list.
2. Show the parsed list to the user: "以下是我读出来的 N 道题，确认/修改/删减"。This is the only interactive checkpoint.
3. After confirmation, run the same write loop as P1, one question at a time.
4. Final report identical to P1.

If the list is ≥ 30 items, warn before processing: "这批有 N 道，是否分批写入？" — single confirmation, then proceed if they say go.

### Vision handling

- Built-in multimodal — no external OCR.
- For unreadable / handwritten text, list those items separately and ask the user to retype rather than guessing.
- Multi-question screenshots are split into individual questions.

## Senior-engineer voice — non-negotiable

- Lead with the load-bearing answer, not boilerplate.
- "常见追问" must reflect what an actual interviewer would ask after the candidate's first answer — not generic follow-ups.
- "易错点" must list things a junior would get wrong but a senior would catch.
- Avoid the LLM-cliché preamble ("这是一个很好的问题…", "需要分几个层面来回答…"). Just answer.
- Default language: Chinese. Code identifiers and English technical terms stay in their original form.

## Note template (locked)

```markdown
# {question}

> {one-liner answer, ≤30 字}

## 核心原理
{200-400 字，讲透 why & how；可拆段落但不必硬塞标题}

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
{3-5 条；面试官真实会顺着问的方向}

## 易错点 / 反直觉
- {senior-only insight 1}
- {senior-only insight 2}

## 何时用 / 何时不用
- ✅ 适用：...
- ❌ 不适用：...

**Tags:** {tag1} · {tag2} · {tag3}
```

Empty / non-applicable sections are dropped entirely (no empty headings).

The `**Tags:** ...` footer is duplicated in the markdown body so they're visible when reading the card; the `tags` array on `create_learning_card` is what the learning module uses for filtering.

## Error handling

| Scenario | Behavior |
|----------|----------|
| `create_learning_card` fails for one question | Continue loop; collect failures; report at end with question text + error message |
| MCP unreachable on first call | Abort; tell the user; do not retry silently |
| Vision read ambiguous | Surface in the P2 confirmation step; don't guess |
| Topic too broad ("八股 后端") | Ask one clarifying question before generating |
| Card returned `topicId` doesn't show up in `/learn` | Likely a deploy lag; tell the user to refresh `/learn` after a minute |

## What this skill does NOT do

- Write into the legacy `create_note` (notes module) — that's the pre-2026-04-30 form factor; do not call it for study cards.
- Create sub-topics. The learning module is one level deep (topic → cards). Use tags, not nested topics.
- SRS / spaced-repetition scheduling. Mastery is the user's manual three-tier rating in the learning UI.
- Dedup. Duplicate-title cards in the same topic are silently skipped by the MCP tool's idempotency, but cross-topic dedup is not attempted.
- Generate code from inside the skill. If a card's "代码 / 示意" section needs an example, write it in the markdown body — don't run separate code generation.

## Quick recipe

```
USER:  整理八股 浏览器渲染 8 道
CLAUDE (this skill):
  1. "好，整理浏览器渲染方向，生成 8 道。"
  2. Generate 8 question titles internally.
  3. For each: produce 6-section markdown body + tags.
  4. Call create_learning_card({ topicName: "浏览器渲染", title, body, tags }) ×8.
  5. Report: "已写入 8 张卡 → /learn (topic '浏览器渲染')。常见 tags：渲染管线、合成、重绘。"
```
