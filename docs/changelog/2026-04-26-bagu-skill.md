# 2026-04-26 — Bagu Skill (面试八股 → knosi)

## Goal

Ship a Claude Code skill that turns a topic prompt or pasted question list into senior-engineer-level Q+A cards, automatically filed into a `八股文` folder in the user's knosi knowledge base. Browsing happens in the existing knosi web UI; no new web feature required.

## Architecture

Two ordered deliverables:

1. **Backend MCP folder param** — extend `save_to_knosi` (and downstream `captureAiConversation`) with an optional `folder` argument so MCP callers can route notes to a named folder instead of the default AI Inbox.
2. **Bagu skill** — a single-file global skill at `~/.claude/skills/bagu/SKILL.md` that detects topic vs. list mode, generates 6-section interview-style cards, and writes one note per question via the knosi MCP.

While the backend work was in progress, a parallel session shipped commit `dcd981b` which added a brand-new `create_note` MCP tool (raw markdown body, no `messages[]` wrapping — fixes a production bug where some MCP clients sent content blocks instead of strings, dropping content). That tool also reused our `resolveOrCreateNamedFolder` helper. The skill was updated to call `create_note` instead of `save_to_knosi` for cleaner output.

## Key changes

### Backend (commits febf002 … 3080ae5, all on `main`)

- New helper `resolveOrCreateNamedFolder(userId, name)` in `src/server/integrations/ai-inbox.ts` — generic get-or-create for top-level folders (sibling of the existing AI Inbox resolver).
- New optional `folder?: string | null` on `AiCaptureInput` plus a corresponding `resolveOrCreateNamedFolder` injectable dependency on `AiCaptureDependencies`. When `folder` is non-empty after trim, `captureAiConversation` routes via the named-folder resolver; otherwise the existing AI Inbox path is preserved unchanged.
- New `folder` schema property on the `save_to_knosi` MCP tool, with a description that explicitly states the trim semantics so AI clients don't expect literal whitespace folder names.
- Three new vitest test files (`ai-inbox.test.ts`, `ai-capture.test.ts`, `mcp-tools.test.ts`) covering create / reuse / trim / empty-name-reject for the helper, AI Inbox regression + named-folder routing for the capture flow, and forward / omit semantics for the MCP dispatcher. Total of 13 new test cases.

### Skill (outside the repo, `~/.claude/skills/bagu/SKILL.md`)

- Single markdown file, invoked by natural-language phrases like "整理八股 RAG" / "八股 后端缓存" / "把这些八股整理一下".
- Two flows: P1 topic-driven (skill generates N questions + answers) and P2 list-driven (user pastes text or screenshot, skill confirms parsed list, then writes).
- Six-section interview template per card (一句话答 / 核心原理 / 代码 / 常见追问 / 易错点 / 何时用何时不用), with empty sections dropped entirely.
- Tags written as a `**Tags:** …` footer in the markdown body (knosi notes don't have a separate tag field for this card type).
- All notes filed into a single fixed `八股文` folder; sub-organization is by tags, not nested folders.
- Uses `create_note` MCP tool (raw markdown body) — not `save_to_knosi` — to avoid messages[] content-block issues observed in production.

### Out of scope (intentionally cut)

- Spaced repetition / SRS scheduling
- Dedup against existing knosi notes (duplicates accepted, easy to delete manually if rare)
- Any new web UI / route in knosi (existing notes browsing handles it)
- Sub-folders under `八股文` (tags do the job)

## Files touched

- `src/server/integrations/ai-inbox.ts` (modified)
- `src/server/integrations/ai-inbox.test.ts` (new)
- `src/server/integrations/ai-capture.ts` (modified)
- `src/server/integrations/ai-capture.test.ts` (new)
- `src/server/integrations/mcp-tools.ts` (modified)
- `src/server/integrations/mcp-tools.test.ts` (new vitest cases — augments commit 503fc01's initial vitest file)
- `~/.claude/skills/bagu/SKILL.md` (new, outside repo)
- `docs/superpowers/specs/2026-04-26-bagu-skill-design.md` (spec)
- `docs/superpowers/plans/2026-04-26-bagu-skill.md` (plan)
- `docs/changelog/2026-04-26-bagu-skill.md` (this entry)

## Verification

- `pnpm build` — TypeScript compile passes (run on the merge commit `3080ae5`). Subsequent runtime DB error during static page collection is pre-existing and unrelated (`data\second-brain.db: 14`).
- `npx eslint src/server/integrations/{ai-inbox,ai-capture,mcp-tools}{,.test}.ts` — 0 problems on all 6 changed files.
- `pnpm test:unit` — **NOT runnable locally**. Pre-existing environment issue: user's local node is v20.17 (no `--experimental-strip-types`); vitest in this project depends on rolldown native bindings that aren't installed (`@rolldown/binding-win32-x64-msvc` missing on worktree, `std-env` ESM/CJS conflict on main). CI only runs `pnpm lint`, so the test files have never been executed. The 13 new test cases are committed for future verification when the local env is fixed.
- Production deploy — Hetzner workflow run #24952482736 completed successfully shortly after the merge of `feature/bagu-skill` into `main`.
- Smoke test (manual, by the user) — **PENDING**. The skill must be tried in a fresh Claude Code session because tool schemas are cached at session start; the session that produced this work cannot see the new `folder` param or the `create_note` tool.

## Smoke test instructions (for the user)

In a fresh Claude Code session, type each of these and verify the result:

1. `整理八股 RAG` — should activate the bagu skill, generate ~10 questions, and write each as a separate note into the `八股文` folder visible at https://www.knosi.xyz.
2. Paste 3-5 interview questions as text — should show a parse confirmation, then write the cards.
3. Paste a screenshot of an interview question list — should use Claude vision to extract questions, surface anything unreadable, and after confirmation write the cards.

If any of those fail, capture the error and reopen this work — the skill itself is a prompt and easy to iterate on.

## Remaining risks / follow-ups

- **Local test runner gap**. The 13 new vitest test cases will run only after the local environment is fixed (upgrade node ≥ 22 or repair the rolldown bindings). Worth opening a separate task to fix the env so future TDD works.
- **Lint config gap**. Eslint config `globalIgnores` lists `**/.next/**` but not `**/.next-e2e/**` or `**/.next-e2e-billing/**`, so running `pnpm lint` from the main repo (which has those build dirs from playwright runs) returns thousands of false-positive errors. Worth adding those globs to `eslint.config.mjs`.
- **`mkdir -p test-results` in `pnpm lint` script** — fails on Windows cmd because `mkdir` interprets `-p` as a directory name. The script works on Linux CI; on Windows the workaround is `npx eslint` directly. Worth replacing with a cross-platform setup (e.g. via `mkdirp` package or just letting eslint create the dir lazily).
- **Skill quality bar.** The `senior-engineer voice — non-negotiable` rules in the skill are prompt-level instructions; they will degrade if/when the underlying model is swapped or weakened. If output quality drifts (generic-sounding 常见追问, etc.), tighten the prompt or add a few-shot example.
