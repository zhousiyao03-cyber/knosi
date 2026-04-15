# Self-Hosted Ops Page Design

- date: 2026-04-15
- goal: Add a single-user, read-only operations page inside Knosi so the owner can inspect deployment, service, queue, daemon, and machine health without SSHing into the Hetzner box for routine checks.

## Problem

Knosi is now self-hosted on Hetzner with Docker Compose, Caddy, Redis, cron, and a local Claude daemon. Routine troubleshooting currently requires SSH and a grab bag of shell commands:

- `docker compose ps`
- container logs
- memory / disk checks
- daemon heartbeat inspection
- queue and cron sanity checks

This works, but it is high-friction for daily use and makes the system feel more operationally opaque than the product itself. The owner wants a lightweight in-product page that answers "is the stack healthy?" before reaching for SSH.

## Constraints

- First version is for a single owner only, not a general admin console.
- Keep the page read-only in v1.
- Reuse the existing authenticated app shell and `/settings` area instead of building a separate website.
- Do not allow arbitrary shell execution from the browser.
- Prefer app-native sources of truth first:
  - database state
  - daemon heartbeats
  - deployment metadata already known by the app
  - in-process metrics
- Any server-level data exposed to the page must come from a narrow allowlisted collector, not a general-purpose command runner.
- The page should remain useful even if some optional data sources are unavailable; degradation should be explicit instead of blank.

## Approaches Considered

### 1. Add a read-only `/settings/ops` page inside the existing app shell

This keeps the feature where the owner already manages the account and AI client settings. Authentication, layout, typography, and navigation stay consistent with the current product.

Pros:

- Lowest implementation cost
- Reuses existing authenticated settings flow
- Easy to hide from non-owner accounts
- Fits the "self-use tool" nature of Knosi

Cons:

- Slightly less "console-like" than a top-level route
- If a richer multi-admin model is needed later, the information architecture may need to move

### 2. Add a top-level `/ops` route in the app

This creates a more dedicated control-plane feeling.

Pros:

- Clear separation from personal account settings
- Easier to evolve into a broader admin console later

Cons:

- More navigation and discoverability work now
- Overstates the current scope for a single-user feature

### 3. Build a separate ops site or service

This maximizes isolation, but it creates a second product to maintain.

Pros:

- Strongest separation of concerns
- Could evolve into a more generic hosting console

Cons:

- Far too much surface area for the current need
- Duplicates auth, layout, deployment, and monitoring plumbing
- Violates YAGNI for a single-user self-hosted app

## Chosen Approach

Use **Approach 1**: add a **single-user, read-only `/settings/ops` page** inside Knosi.

The page should answer five operational questions quickly:

1. What version is running?
2. Are the core services healthy?
3. Is the local daemon online and processing work?
4. Is work piling up in queues or cron?
5. Is the host under pressure?

This keeps v1 intentionally narrow: observability, not control.

## Page Structure

The page lives at `/settings/ops` and renders inside the same authenticated shell as `/settings`. The existing `/settings` page remains the account-management landing page; the new page is a sibling route, not a replacement.

### 1. Deployment Card

Purpose: show exactly what is running.

Fields:

- current git SHA
- current Next.js deployment id
- deploy source:
  - `github-actions`
  - `manual`
  - `unknown`
- deploy timestamp
- environment:
  - `production`

Why this matters:

- Confirms whether the last push actually reached the server
- Shortens the "is this old code?" debugging loop

### 2. Services Card

Purpose: summarize whether the core stack is up.

Fields:

- app status (`knosi`)
- Redis status
- Caddy status
- last daemon heartbeat time
- daemon online/offline badge
- Redis round-trip health

Display model:

- each service gets a badge: `healthy`, `degraded`, or `unknown`
- daemon should show both recency and human-friendly age, e.g. "12s ago"

### 3. Queue Card

Purpose: surface whether work is flowing or getting stuck.

Fields:

- `chat_tasks` counts by status:
  - queued
  - running
  - completed (recent window)
  - failed (recent window)
- optional structured-task counts if they are already available from the same query path
- recent task activity list:
  - task id (truncated)
  - task type
  - status
  - updated time

Why this matters:

- Confirms Ask AI is draining
- Makes daemon regressions visible without log diving

### 4. System Card

Purpose: expose host pressure at a glance.

Fields:

- memory used / total
- disk used / total
- load average
- uptime
- optional container restart counts if easy to obtain from the collector

Important boundary:

- These values come from a fixed server collector response, not browser-triggered arbitrary commands.

### 5. Health Card

Purpose: aggregate the "should I SSH now?" signal.

Fields:

- overall status badge:
  - `healthy`
  - `degraded`
  - `down`
- last cron success times for key jobs:
  - jobs tick
  - stale chat cleanup
  - optional portfolio cron if enabled
- recent slow-query count
- recent app-error count
- last updated timestamp for the whole page snapshot

Why this matters:

- Gives the owner one summary block before checking details

## Navigation And Access Model

This page is intentionally **owner-only**, not "all logged-in users."

Authorization model:

- user must be logged in
- user id or email must match a single configured owner identity
- all non-owner users should receive `404` instead of a discoverable admin page

Rationale:

- simpler and safer than introducing full RBAC
- fits the stated "only I need to see it" requirement

Configuration:

- add a single env var for the owner identity, preferably email
- if the owner identifier is missing, the page should render an explicit unavailable state for the owner and remain hidden from everyone else

## Data Sources

The page should assemble data from two classes of sources.

### A. App-native data

These are already within Knosi's responsibility boundary:

- current deployment id from runtime env / build metadata
- git SHA from runtime env / deploy metadata
- daemon heartbeat from `daemon_heartbeats`
- queue counts from `chat_tasks`
- in-process metrics from the existing metrics store
- cron run records from an explicit DB-backed heartbeat table or equivalent app-owned status source

These should be queried directly from server-side route code or page loaders.

### B. Host-native data

These come from the self-hosted machine and should be collected via a narrow allowlist:

- memory
- disk
- load
- uptime
- service summary

Design rule:

- create one tiny internal collector endpoint or helper that returns a typed JSON snapshot
- the collector may use shell commands internally, but only for a fixed allowlisted set
- the page never receives command execution capability

## Collector Boundary

The collector is the only piece allowed to bridge app code and host introspection.

It should return a shape like:

```ts
type OpsSystemSnapshot = {
  generatedAt: string;
  host: {
    uptimeSeconds: number;
    loadAverage: [number, number, number];
    memory: { usedBytes: number; totalBytes: number };
    disk: { usedBytes: number; totalBytes: number; mount: string };
  };
  services: Array<{
    name: "knosi" | "redis" | "caddy";
    status: "healthy" | "degraded" | "unknown";
    detail?: string;
  }>;
};
```

The implementation can decide whether this snapshot is generated:

- directly in-process on the web app host, or
- through a loopback-only helper route

But the browser-facing contract should remain a small typed summary.

## Degradation Strategy

The page must degrade per card, not fail as one giant request.

Examples:

- if Redis is down, show Redis as `degraded` and still render deployment and system data
- if host metrics collection fails, show the System card as unavailable while still rendering queue and daemon state
- if daemon heartbeat is stale, show the Services and Health cards as degraded, but do not block the whole page

Every unavailable section should render an explicit reason:

- `collector unavailable`
- `missing owner config`
- `metrics not yet available`

## Refresh Model

This is an inspection page, not a live terminal.

First version behavior:

- server-render a fresh snapshot on page load
- allow manual refresh
- optionally auto-refresh on a coarse interval like 10-15 seconds only if the implementation stays simple

Non-goal for v1:

- streaming logs
- second-by-second live charts

## UX Tone

The page should feel like a calm cockpit, not an enterprise observability wall.

Guidance:

- compact cards
- status-first layout
- muted detail text
- human-readable timestamps
- avoid noisy sparkline dashboards in v1

The owner should be able to answer "do I need SSH?" within one screen.

## Non-Goals

The following are explicitly out of scope for v1:

- editing `.env.production`
- restarting containers
- tailing raw logs in the browser
- running shell commands from the UI
- multi-machine management
- multi-admin permissions
- alert routing / paging
- historical metrics storage beyond what already exists

## Verification Strategy

When this is implemented, verification should include:

- owner access works and non-owner access is hidden
- deployment card matches current production env metadata
- daemon heartbeat and queue counts match known DB state
- collector returns typed host stats and fails safely when unavailable
- page renders partial data instead of blanking on one failing card
- lint + build
- a real authenticated browser check for `/settings/ops`

## Open Decision Resolved

The owner-only requirement means v1 should **not** introduce general admin roles. A single configured owner identity is the chosen authorization model.
