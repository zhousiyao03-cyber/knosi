<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Knosi Working Agreement

> Universal agent protocol for Knosi. Tool-agnostic — Claude Code, Codex, Cursor and any other agent should follow this.
> Concrete operating instructions (commands, commit templates, code conventions, editor specifics) live in `CLAUDE.md`.

## Project Context

- This repository is Knosi — a self-hosted personal knowledge management platform with AI capabilities ([knosi.xyz](https://www.knosi.xyz)).
- Active modules: see `src/components/layout/navigation.ts` (single source of truth).
- Designs for new modules: `docs/superpowers/specs/`.
- Landed work log: `docs/changelog/`.
- Historical plans: `docs/archive/`.

## Definition Of Done

A task is not complete until **all** of the following are true:

1. The implementation is finished.
2. Affected documentation is updated (changelog entry; README if user-facing surface changed).
3. The change is verified with **real** commands or **real** checks — not "should work in theory".
4. The handoff response includes what changed, how it was verified, and any remaining risks.

## Verification Principles

- Never claim a change is verified unless you actually ran a verification step.
- Choose the strongest realistic check for the scope:
  - UI / navigation / cross-page flows → e2e
  - Server logic / DB / utilities → unit or integration tests
  - Broad changes → also run lint and build
- If a user-facing flow changes and no e2e exists, add a minimal one rather than skip.
- For bug fixes, reproduce before fixing when feasible.
- For schema changes that affect deployed environments, do not stop at local `db:push` — production rollout must be performed and recorded, or explicitly flagged as a follow-up blocker.

## Handoff Output

The final response for any substantive task must include:

1. What changed.
2. Which docs were updated.
3. Which verification commands/checks were run, with actual outcomes.
4. Any blockers, assumptions, or residual risks.

If the environment prevents execution, state the exact blocker. Do not pretend a check passed.

## Partial Completion

If a task completes only partially, leave a clear changelog entry describing what is done and what remains. Prefer small reviewable increments that keep the repo runnable.
