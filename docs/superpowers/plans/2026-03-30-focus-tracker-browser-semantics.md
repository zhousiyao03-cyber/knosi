# Focus Tracker Browser Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser sessions in Focus Tracker explain what the user was doing using URL/title semantics and server-side activity blocks, without a browser extension.

**Architecture:** The desktop collector extracts structured browser semantics from URL + page title, sends those normalized fields to the server, and the server applies deterministic rules plus block-level labeling for display. The Web UI keeps all data and metrics intact but collapses short rows under ten minutes by default.

**Tech Stack:** Rust/Tauri, Next.js 16, React 19, tRPC, Drizzle ORM, SQLite/libsql

---

## File Structure

### Desktop

| File | Responsibility |
|------|---------------|
| `focus-tracker/src-tauri/src/accessibility.rs` | Stable browser URL/title capture |
| `focus-tracker/src-tauri/src/tracker.rs` | Build semantic snapshot fields into samples |
| `focus-tracker/src-tauri/src/sessionizer.rs` | Persist semantic fields into queued sessions |
| `focus-tracker/src-tauri/src/uploader.rs` | Serialize semantic payload to ingest API |

### Server

| File | Responsibility |
|------|---------------|
| `src/server/db/schema.ts` | New semantic columns |
| `src/app/api/focus/ingest/route.ts` | Accept semantic fields |
| `src/app/api/focus/status/route.ts` | Return semantic fields |
| `src/server/focus/tags.ts` | Extend tag inference using browser semantics |
| `src/server/focus/aggregates.ts` | Activity block grouping and labeling |
| `src/server/routers/focus.ts` | Surface semantic block data to Web |

### Web

| File | Responsibility |
|------|---------------|
| `src/components/focus/focus-display.ts` | Display threshold helpers |
| `src/components/focus/focus-page-client.tsx` | Collapse short rows, show semantic labels |

---

## Task 1: Web — Collapse Short Rows By Default

**Files:**
- Create: `src/components/focus/focus-display.ts`
- Create: `src/components/focus/focus-display.test.mjs`
- Modify: `src/components/focus/focus-page-client.tsx`

- [ ] Add a pure helper that splits sessions into visible and hidden groups using a `10m` display threshold.
- [ ] Verify the helper with `node:test`, including threshold boundary behavior and focused-seconds handling.
- [ ] Update `/focus` so:
  - focus blocks under `10m` are hidden by default
  - raw sessions under `10m` are hidden by default
  - each hidden group is summarized with total time and count
  - the user can explicitly expand short rows
- [ ] Keep all metrics, top-apps data, and persisted sessions unchanged.

## Task 2: Desktop — Derive Browser Semantic Fields

**Files:**
- Modify: `focus-tracker/src-tauri/src/accessibility.rs`
- Modify: `focus-tracker/src-tauri/src/tracker.rs`
- Modify: `focus-tracker/src-tauri/src/sessionizer.rs`

- [ ] Add URL parsing helpers that derive:
  - `browser_host`
  - `browser_path`
  - `browser_search_query`
  - `browser_surface_type`
- [ ] Start with rule-based support for:
  - Google search
  - GitHub repo / PR / issue
  - ChatGPT chat
  - Docs / Figma / mail / calendar
- [ ] Store only normalized semantic values, never raw page content.

## Task 3: Server — Persist Semantic Snapshot

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/app/api/focus/ingest/route.ts`
- Modify: `src/app/api/focus/status/route.ts`
- Modify: `drizzle/*.sql`

- [ ] Add nullable semantic columns for host/path/query/surface type.
- [ ] Accept these fields at ingest time.
- [ ] Return these fields to desktop sync and Web consumers.
- [ ] Add migration coverage and verify both local and remote-compatible schema behavior.

## Task 4: Server — Rule Engine And Semantic Tags

**Files:**
- Modify: `src/server/focus/tags.ts`
- Create: `src/server/focus/rules.ts`
- Add tests near `src/server/focus/`

- [ ] Introduce deterministic rule priority:
  - user rule
  - host rule
  - path rule
  - title keyword rule
  - app fallback
- [ ] Emit:
  - tags
  - `browser_surface_type`
  - display label candidate
  - work-hours inclusion override where needed
- [ ] Cover common known-site behavior with executable tests.

## Task 5: Server/Web — Activity Block Labels

**Files:**
- Modify: `src/server/focus/aggregates.ts`
- Modify: `src/server/routers/focus.ts`
- Modify: `src/components/focus/focus-page-client.tsx`

- [ ] Group nearby sessions into semantic activity blocks when they share the same intent key.
- [ ] Prefer semantic display labels over raw app names.
- [ ] Show labels like:
  - `Google Search: rust tauri accessibility`
  - `GitHub PR review`
  - `Figma design review`
- [ ] Verify that block labeling never changes stored totals or work-hours math.

## Task 6: Docs And Verification

**Files:**
- Modify: `README.md`
- Add: `docs/changelog/*.md`

- [ ] Update Focus Tracker status in README once semantic labeling lands.
- [ ] Append changelog entries for each non-trivial rollout step.
- [ ] Verify with:
  - targeted `node --test --experimental-strip-types ...`
  - `cargo test` in `focus-tracker/src-tauri`
  - `pnpm build`
  - one real production-like ingest/status smoke test before claiming completion
