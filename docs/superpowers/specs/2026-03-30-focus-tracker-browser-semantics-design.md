# Focus Tracker Browser Semantics Design

## Goal

Make browser activity in Focus Tracker feel closer to Rize without introducing a browser extension or storing page content.

## Product Problem

The current V2 collector can tell that a session happened in `Google Chrome`, and sometimes which URL was open, but it still cannot reliably answer the more useful question: what was the user doing inside the browser?

That creates two UX problems:

1. `/focus` spends too much space on low-signal browser labels like `Google Chrome`
2. the user cannot distinguish search, docs reading, PR review, chat, mail, or design work without opening every row

## Constraints

- No browser extension
- No raw AX tree upload
- No page body capture or screenshots
- Keep the desktop collector lightweight and privacy-bounded
- Preserve current V2 server-authoritative aggregation model

## Design Direction

We will follow a Rize-style desktop pipeline:

1. Capture frontmost app, window title, browser URL, and browser page title
2. Derive browser semantics locally from URL + title + known-site rules
3. Send normalized semantic fields to the server
4. Let the server tag, merge, and label activity blocks for display

This improves “what was I doing?” without requiring DOM access or browser-native instrumentation.

## Browser Semantic Snapshot

Each enriched browser session should eventually expose:

- `browser_url`
- `browser_page_title`
- `browser_host`
- `browser_path`
- `browser_search_query`
- `browser_surface_type`

`browser_surface_type` is a bounded enum-like string:

- `search`
- `docs`
- `repo`
- `pr`
- `issue`
- `chat`
- `video`
- `design`
- `mail`
- `calendar`
- `unknown`

## Extraction Strategy

### 1. URL-first parsing

Prefer URL-derived signals because they are the most stable and least privacy-invasive:

- host
- pathname
- search params

Examples:

- `google.com/search?q=rust+ax+api` → `surface_type=search`, `search_query="rust ax api"`
- `github.com/org/repo/pull/42` → `surface_type=pr`
- `github.com/org/repo/issues/12` → `surface_type=issue`
- `docs.google.com/document/...` → `surface_type=docs`
- `figma.com/design/...` → `surface_type=design`

### 2. Title-assisted refinement

Use `browser_page_title` to refine labels and fill gaps when URL alone is ambiguous.

Examples:

- search result titles
- chat thread titles
- document titles
- meeting titles

### 3. Rule-based known-site classification

Maintain a server-side rule table for common sites and workflows:

- app rule
- host rule
- path rule
- title keyword rule

Rules produce:

- tags
- `browser_surface_type`
- optional display label template
- optional work-hours inclusion override

### 4. No raw content capture

Do not store:

- page body text
- screenshots
- raw AX tree
- arbitrary DOM snippets

This keeps the system aligned with the “Rize-like” product boundary: strong activity inference, not full content surveillance.

## Activity Blocks

The server should move from “session-first display” toward “activity block display.”

Activity blocks are merged from nearby sessions that share the same semantic intent, for example:

- repeated Google searches in one research burst
- a GitHub PR review interrupted briefly by Slack
- a Figma review split by a short app switch

Each block should prefer a semantic label over raw app name:

- `Google Search: rust tauri accessibility`
- `GitHub PR review`
- `Figma design review`
- `ChatGPT drafting`

## Web Display Rules

To reduce noise, the Web UI should hide short rows by default:

- focus blocks under `10m` are collapsed into a short-block summary
- raw sessions under `10m` are collapsed into a short-session summary
- this affects display only, never storage, metrics, or work-hours calculations

## Rollout Order

1. Web display cleanup for short sessions
2. Browser semantic field extraction from URL/title
3. Server schema expansion for semantic fields
4. Rule engine for host/path/title classification
5. Activity block naming based on semantic snapshot

## Risks

- URL/title-only inference is weaker than a full browser integration for certain apps
- known-site rules require maintenance
- activity labels can drift if rule priority is not explicit

## Non-Goals

- browser extension support
- raw AX tree persistence
- page body indexing
- screenshot capture
