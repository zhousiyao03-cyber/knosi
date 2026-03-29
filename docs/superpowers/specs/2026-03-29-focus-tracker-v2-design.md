# Focus Tracker V2 — Signal Hub Architecture

## Problem Statement

The current focus tracker has four core issues:

1. **Inaccurate recording** — Conservative thresholds (10s switch confirmation, 30s minimum session, 30min idle) drop too many short interactions
2. **Shallow activity data** — Only captures app name + window title; no browser URL, no multi-screen awareness
3. **Desktop/server data inconsistency** — Double merging (client pre-merges, server re-merges), divergent classification logic (client keyword matching vs server AI), and overlay deduplication bugs
4. **Poor multi-screen tracking** — Only tracks the single `frontmost` process; brief switches to secondary screens are filtered out entirely

## Solution Overview

Upgrade the desktop collector from a single-signal sampler to a multi-signal aggregator using macOS Accessibility API and CGWindowList, while restructuring the client-server data flow so the server is the single source of truth for merging, tagging, and metrics.

## Architecture

### Sampling Pipeline (every 5s)

```
1. AppleScript        → app_name, window_title     (existing)
2. AX API (browsers)  → browser_url                 (new)
3. CGWindowList       → visible_windows              (new)
4. AppleScript        → idle_seconds                 (existing)
         ↓
   EnrichedSample
         ↓
   Sessionizer (lowered thresholds)
         ↓
   QueuedSession (with rich signals, NO pre-merging)
         ↓
   Outbox (append-only, dedupe by source_session_id)
         ↓
   Upload raw sessions every 120s
         ↓
   Server: ingest → autoTag → store → merge on read
```

### Graceful Degradation

If the user has not granted Accessibility permission:
- Browser URL and visible windows signals are unavailable
- Falls back to existing app_name + window_title tracking
- All other functionality works normally

## Section 1: Enriched Data Model

### EnrichedSample (replaces WindowSample)

```rust
struct EnrichedSample {
    // Existing (from AppleScript)
    app_name: String,
    window_title: Option<String>,

    // New: browser signal (from AX API)
    browser_url: Option<String>,
    browser_page_title: Option<String>,

    // New: multi-screen signal (from CGWindowList)
    visible_windows: Vec<VisibleWindow>,
}

struct VisibleWindow {
    app_name: String,
    window_title: Option<String>,
    screen_index: u32,
    is_frontmost: bool,
}
```

### QueuedSession (extended)

```rust
struct QueuedSession {
    // Existing
    source_session_id: String,
    app_name: String,
    window_title: Option<String>,
    started_at: DateTime<Utc>,
    ended_at: DateTime<Utc>,
    duration_secs: i64,

    // New
    browser_url: Option<String>,
    browser_page_title: Option<String>,
    visible_apps: Vec<String>,  // app names visible on other screens
}
```

`visible_apps` stores only app name strings (not full VisibleWindow) as context for server-side tagging.

Note: `browser_page_title` is the page title reported by AX API (e.g., "Go by Example: Goroutines"), while `window_title` is the macOS window title from AppleScript (e.g., "Go by Example: Goroutines - Google Chrome"). They may overlap for browsers but serve different roles: `browser_page_title` is the clean page title without app name suffix, useful for tagging and display.

## Section 2: Threshold Adjustments

| Parameter | Old | New | Rationale |
|-----------|-----|-----|-----------|
| `SWITCH_CONFIRMATION_SECS` | 10 | 3 | Capture brief screen switches |
| `MIN_SESSION_SECS` | 30 | 5 | Keep short interactions (Slack replies, doc checks) |
| `IDLE_THRESHOLD_SECS` | 1800 | 180 | 3min idle is a real break; 30min was far too generous |
| `LOW_PRIORITY_IGNORE_SECS` | 120 | 30 | System apps still filtered but less aggressively |

## Section 3: Client-Side Changes

### 3.1 Remove Pre-Merging

Delete `should_merge_sessions()` and `push_or_merge_session()` from `outbox.rs`. Replace with simple append + source_session_id deduplication. All merging is the server's responsibility.

### 3.2 Simplify Metrics Calculation

`metrics_for_today()` and `timeline_for_today()` in `state.rs`:
- **With server snapshot**: Use server's focusedSecs/workHoursSecs as base, overlay only sessions from `queued_sessions` not yet acknowledged by server
- **Without server snapshot (offline)**: Use `recent_sessions` directly, with local `task_group()` as fallback classification
- Delete the dual-source merge logic in `merged_sessions_for_display()`

### 3.3 Upload Payload Extension

```json
{
  "deviceId": "...",
  "timeZone": "Asia/Shanghai",
  "sessions": [{
    "sourceSessionId": "...",
    "appName": "Google Chrome",
    "windowTitle": "Go by Example: Goroutines",
    "browserUrl": "https://gobyexample.com/goroutines",
    "browserPageTitle": "Go by Example: Goroutines",
    "visibleApps": ["Visual Studio Code", "Ghostty"],
    "startedAt": "...",
    "endedAt": "...",
    "durationSecs": 245
  }]
}
```

All new fields are nullable for backward compatibility with older desktop versions.

## Section 4: Accessibility API Integration

### 4.1 Permission Detection

On startup, check `AXIsProcessTrusted()`. If not trusted, show a one-time prompt guiding the user to System Settings > Privacy & Security > Accessibility.

### 4.2 Browser URL via AX API

When the frontmost app is a known browser, read the address bar value:

```rust
fn get_browser_url(app_name: &str) -> Option<String> {
    if !is_browser(app_name) { return None; }

    // Chromium-based (Chrome, Arc, Brave, Edge):
    //   AXApplication → AXWindow → AXToolbar → AXTextField → AXValue
    //
    // Safari:
    //   AXApplication → AXWindow → AXGroup → AXTextField → AXValue

    // Read AXValue from the address bar text field
}

fn is_browser(app_name: &str) -> bool {
    matches!(app_name.to_lowercase().as_str(),
        "google chrome" | "safari" | "arc" | "firefox"
        | "brave browser" | "microsoft edge" | "chromium")
}
```

### 4.3 Multi-Screen Visible Windows via CGWindowList

```rust
fn get_visible_windows() -> Vec<VisibleWindow> {
    // CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)
    // For each window: kCGWindowOwnerName, kCGWindowName, kCGWindowBounds
    // CGGetActiveDisplayList for screen geometry
    // Match window bounds against screen frames to determine screen_index
}
```

This API does not require Accessibility permission on its own, but is grouped with the AX flow since both contribute to EnrichedSample.

## Section 5: Server-Side Changes

### 5.1 DB Schema Changes

`activitySessions` table modifications:

```sql
-- Remove
DROP COLUMN category;

-- Add
ADD COLUMN tags            TEXT;  -- JSON array, nullable
ADD COLUMN browser_url     TEXT;  -- nullable
ADD COLUMN browser_page_title TEXT;  -- nullable
ADD COLUMN visible_apps    TEXT;  -- JSON array, nullable
```

`focusDailySummaries` table: rename `categoryBreakdown` to `tagBreakdown`.

All new columns are nullable. Old sessions and old desktop clients are unaffected.

### 5.2 Tag System (replaces fixed categories)

Replace `categories.ts` with `tags.ts`. A session can have multiple non-exclusive tags:

```typescript
function autoTag(session): string[] {
  const tags: string[] = [];

  // 1. From browser_url (most reliable signal)
  if (session.browserUrl) {
    tags.push("browser");
    tags.push(...domainTags(session.browserUrl));
    // github.com → ["git", "coding"]
    // gobyexample.com → ["golang", "learning"]
    // youtube.com → ["entertainment"] (unless title has coding keywords)
    // docs.google.com → ["docs", "writing"]
    // meet.google.com → ["meeting"]
    // mail.google.com → ["communication"]
  }

  // 2. From app name (fallback)
  tags.push(...appTags(session.appName));
  // "VS Code" → ["editor", "coding"]
  // "Figma" → ["design"]
  // "Zoom" → ["meeting"]
  // "Slack" → ["communication"]
  // "Ghostty" → ["terminal", "coding"]

  return dedupe(tags);
}
```

Tag types:
- **Descriptive**: browser, terminal, editor, meeting, communication, design — what tool
- **Content**: golang, rust, javascript, second-brain, learning, entertainment — what activity

### 5.3 Work Hours: Exclusion-Based

```typescript
const NON_WORK_TAGS = ["entertainment", "social-media", "gaming"];

function countsTowardWorkHours(session): boolean {
  const tags = session.tags ?? [];
  return !tags.some(tag => NON_WORK_TAGS.includes(tag));
}
```

Sessions without entertainment/social-media/gaming tags count as work hours by default.

### 5.4 Double-Merge Fix

No server-side merge logic changes needed. The root cause was pre-merged input from the client. With the client sending raw sessions (Section 3.1), the existing `buildDisplaySessionsFromSlices()` with `DISPLAY_MERGE_GAP_SECS=120` and `DISPLAY_TRANSIENT_SECS=120` will produce correct results.

### 5.5 Status API Response Enhancement

`displaySessions` in `/api/focus/status` response gains new fields:

```json
{
  "sourceSessionId": "...",
  "appName": "Google Chrome",
  "windowTitle": "Go by Example",
  "browserUrl": "https://gobyexample.com/goroutines",
  "tags": ["browser", "golang", "learning", "coding"],
  "focusedSecs": 245,
  "spanSecs": 280,
  "interruptionCount": 1,
  "contextApps": ["Visual Studio Code", "Ghostty"]
}
```

- `browserUrl`: URL from the longest session in a merged block
- `tags`: Server-assigned tags (client uses these directly, no local classification)
- `contextApps`: Aggregated visible_apps from constituent sessions

### 5.6 AI Daily Summary

`focusDailySummaries.aiAnalysis` receives all session data including tags, browser URLs, and visible apps. Generates free-form summaries organized by project/activity rather than fixed categories:

> "5.2h on second-brain project (3.1h Rust backend + 1.4h React frontend + 0.7h reading docs). 1.2h learning Go (gobyexample + YouTube tutorials). 0.5h communication."

## Section 6: File Change Summary

### Desktop (focus-tracker/src-tauri/src/)

| File | Change |
|------|--------|
| `tracker.rs` | Add `get_browser_url()` (AX API), `get_visible_windows()` (CGWindowList), AX permission check |
| `sessionizer.rs` | `WindowSample` → `EnrichedSample`, update four threshold constants |
| `outbox.rs` | Remove `should_merge_sessions()` / `push_or_merge_session()`, pure append |
| `state.rs` | Simplify `metrics_for_today()` and `timeline_for_today()`, remove dual-source merge, `task_group()` offline-only fallback |
| `uploader.rs` | Add browser_url, browser_page_title, visible_apps to IngestPayload |
| `lib.rs` | Integrate new signals into sampling loop |
| **New** `accessibility.rs` | AX API wrappers (browser URL extraction, permission detection) |
| **New** `window_list.rs` | CGWindowList wrapper (visible windows per screen) |

### Server (src/)

| File | Change |
|------|--------|
| `server/db/schema.ts` | activitySessions: drop category, add tags/browser_url/browser_page_title/visible_apps. focusDailySummaries: categoryBreakdown → tagBreakdown |
| `server/focus/categories.ts` | Delete, replace with `server/focus/tags.ts` |
| **New** `server/focus/tags.ts` | autoTag(), domainTags(), appTags(), countsTowardWorkHours() |
| `server/focus/aggregates.ts` | Update countsTowardWorkHours() to exclusion-based, displaySession includes tags |
| `app/api/focus/ingest/route.ts` | Accept new nullable fields, call autoTag() on ingest |
| `app/api/focus/status/route.ts` | Return tags instead of category, add browserUrl and contextApps to displaySessions |

### Not Changed

- Frontend web UI (focus dashboard) — tags display adaptation deferred
- Device pairing flow
- Upload interval (120s), status sync interval (30s)
- Local persistence format (JSON outbox, structure changes but format stays JSON)

## Backward Compatibility

- All new upload fields are nullable; old desktop clients work without changes
- Server ingest accepts both old (no browser_url/tags) and new payloads
- Desktop degrades gracefully without Accessibility permission
- Existing sessions in DB get null for new columns; classification falls back to app_name heuristics
