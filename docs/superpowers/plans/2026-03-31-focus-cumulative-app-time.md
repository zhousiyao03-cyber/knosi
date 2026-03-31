# Focus Cumulative App Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/focus` and the dashboard show simple cumulative per-app time instead of prioritizing derived `focused/span` semantics for `Top apps` and `Focus blocks`.

**Architecture:** Re-point the web UI to raw daily session slices for timeline, app aggregation, and block listing so displayed time matches recorded app time. Keep server-side classification and work-hour totals intact, but remove focused/span emphasis from the main web presentation and docs.

**Tech Stack:** Next.js 16 App Router, React 19 client components, tRPC, Node test runner, Playwright

---

### Task 1: Lock the new cumulative-time behavior with failing tests

**Files:**
- Modify: `src/components/focus/focus-top-apps.test.mjs`
- Modify: `src/components/focus/focus-display.test.mjs`
- Modify: `e2e/focus-tracker.spec.ts`

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run targeted tests to verify they fail for the expected reason**
- [ ] **Step 3: Confirm the failures point to focused/span semantics still being used**

### Task 2: Switch web aggregation to raw cumulative app time

**Files:**
- Modify: `src/components/focus/focus-top-apps.ts`
- Modify: `src/components/focus/focus-display.ts`
- Modify: `src/components/focus/focus-page-client.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Update helper functions to always use `durationSecs`**
- [ ] **Step 2: Query raw daily sessions in `/focus` and dashboard for timeline and app aggregation**
- [ ] **Step 3: Simplify copy and labels so the page clearly describes cumulative app time**
- [ ] **Step 4: Re-run targeted tests and make them pass**

### Task 3: Update project docs and run verification

**Files:**
- Modify: `README.md`
- Add: `docs/changelog/2026-03-31-focus-cumulative-app-time.md`

- [ ] **Step 1: Update README focus description to describe cumulative per-app time**
- [ ] **Step 2: Add changelog entry with commands and outcomes**
- [ ] **Step 3: Run targeted unit tests, Playwright focus flow, lint, and any focused build-safe checks used for touched files**
