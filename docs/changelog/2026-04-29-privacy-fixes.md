# 2026-04-29 — privacy hardening pass

## Goal

Fix concrete user-data leakage paths discovered during a security audit of the
whole app. Scope is intentionally surgical — each item is a self-contained
behavior change with an attack/leak path documented in the audit.

## Findings being addressed

| ID | Severity | Issue |
|----|----------|-------|
| HIGH 1 | High | `/sitemap.xml` enumerated every `notes.shareToken` and `osProjectNotes.shareToken` row, turning private capability URLs into a Google-indexed list. |
| HIGH 2 | High | `/api/cron/cleanup-stale-chat-tasks` failed open when `CRON_SECRET` was unset (`if (env && hdr !== ...)` short-circuits to allow). |
| HIGH 3 | High | Vercel AI SDK `experimental_telemetry` defaults `recordInputs/recordOutputs` to true — when Langfuse is configured, full prompts (with RAG-injected note bodies) and full LLM completions ship to `cloud.langfuse.com`. |
| HIGH 3b | High | `chat-prepare.ts` / `chat-enqueue.ts` passed the raw `userQuery` as `updateActiveObservation` input, which flows to Langfuse regardless of `recordInputs`. |
| HIGH 3c | High | `/cli/auth?session_id=…` page loaded the Cloudflare Insights beacon (`static.cloudflareinsights.com/beacon.min.js`) which records the full URL — including the bearer-equivalent `session_id`. |
| MED   | Medium | `daemon-chat-events.ts` log on parse failure included the full raw redis chat payload (`message`), which on a valid-but-bug producer can contain streaming deltas / final assistant text. |
| MED   | Medium | `pino` logger had no `redact` config — any future careless log site could leak passwords/tokens/email/chat content. |

## Changes

### Sitemap + share pages (HIGH 1)

- `src/app/sitemap.ts`
  - Removed the `notes`/`osProjectNotes` enumeration. The function is now sync
    and returns only `/`, `/pricing`, `/legal/*`. Shares were never meant to
    be a public crawl surface; the share token's unguessability is the access
    control, and emitting them in sitemap.xml defeated that.
- `src/app/share/[token]/page.tsx`
- `src/app/share/project-note/[token]/page.tsx`
  - Added `export const metadata` with `robots: { index: false, follow: false, nocache: true }` so engines that do not honor robots.txt for already-known URLs still drop the page from indices.
- `src/app/robots.ts`
  - Moved `/share/` from `allow` to `disallow` for `*` (was previously
    explicitly allowed).

**Follow-up (operator):** check Google Search Console for any `site:www.knosi.xyz/share/` pages already indexed. If so, submit removal requests and rotate the affected `shareToken` rows so re-crawls 404.

### Cron auth (HIGH 2)

- `src/app/api/cron/cleanup-stale-chat-tasks/route.ts`
  - Changed the gate from `if (process.env.CRON_SECRET && hdr !== ...)` (fail
    open if secret unset) to `if (!cronSecret || hdr !== ...)` (fail closed),
    matching the existing `cron/portfolio-news` pattern.

### AI telemetry (HIGH 3 + 3b)

- `src/server/ai/provider/ai-sdk.ts`
  - `streamChatAiSdk` and `generateStructuredDataAiSdk` now pass
    `experimental_telemetry: { isEnabled: true, recordInputs: rec, recordOutputs: rec }`
    where `rec = process.env.LANGFUSE_RECORD_CONTENT === "true"`. Trace
    structure / latencies still flow when Langfuse is enabled; full prompt
    text + completions only ship if the operator explicitly opts in.
- `src/server/ai/chat-prepare.ts`
- `src/server/ai/chat-enqueue.ts`
  - Replaced `updateActiveObservation({ input: { query: userQuery, sourceScope } })`
    with `{ input: { queryLength: userQuery.length, sourceScope } }`. Same
    rationale — Langfuse trace structure stays useful, raw query stays local.

### CLI auth referrer + analytics (HIGH 3c)

- `src/components/cloudflare-insights.tsx` (new)
  - Wraps the Cloudflare Insights `<Script>` in a client component that uses
    `usePathname` to skip the beacon on `/cli/auth*`. The beacon records the
    full page URL, which on the auth page contains `session_id`.
- `src/app/layout.tsx`
  - Replaces the inline `<Script>` with `<CloudflareInsights />`.
- `src/app/(app)/cli/auth/layout.tsx` (new)
  - Sets `metadata.referrer = "no-referrer"` and `robots: { index: false, … }`
    so any third-party resource the page loads (fonts, error reporters, etc.)
    cannot leak `session_id` via the Referer header, and search engines can't
    cache the URL.

### Log hygiene (MED)

- `src/server/ai/daemon-chat-events.ts`
  - The `ask_ai.chat_event_parse_failed` log no longer includes the raw
    `message`. Logs `messageLength` + `messageHead.slice(0, 64)` instead.
- `src/server/logger.ts`
  - Added defense-in-depth `pino.redact` paths covering common PII/secret
    field names: `password`, `passwordHash`, `authorization`, `cookie`,
    `token`, `accessToken`, `refreshToken`, `clientSecret`, `client_secret`,
    `prompt`, `completion`, `delta`, `totalText`, `messages`, `*.email`.
    Censor: `[REDACTED]`. This catches accidents — log sites should still
    avoid these field names where possible.

## Files touched

```
src/app/(app)/cli/auth/layout.tsx           (new)
src/app/api/cron/cleanup-stale-chat-tasks/route.ts
src/app/layout.tsx
src/app/privacy-fixes.test.ts               (new — vitest)
src/app/robots.ts
src/app/share/[token]/page.tsx
src/app/share/project-note/[token]/page.tsx
src/app/sitemap.ts
src/components/cloudflare-insights.tsx      (new)
src/server/ai/chat-enqueue.ts
src/server/ai/chat-prepare.ts
src/server/ai/daemon-chat-events.ts
src/server/ai/provider/ai-sdk.ts
src/server/logger.ts
docs/changelog/2026-04-29-privacy-fixes.md  (this file)
```

## Verification

- `pnpm build` — ✅ green (TypeScript + Turbopack production build).
- `pnpm lint` — ✅ green (0 errors; the 4 `'content' is defined but never used`
  warnings in `chat-enqueue.ts:67/86` and `chat-prepare.ts:159/181` are the
  pre-existing privacy-preserving destructures `({ content, ...meta }) => meta`
  that intentionally drop content from telemetry — kept verbatim).
- `pnpm test:unit src/app/privacy-fixes.test.ts` — ✅ 8/8 pass:
  - sitemap returns no `/share/` URLs and is sync (no DB call).
  - robots disallows `/share/` and does not allow it.
  - both share pages export `robots: { index: false, follow: false }`.
  - `/cli/auth` layout sets `referrer: "no-referrer"` and `robots.index: false`.
- `pnpm test:e2e` — **skipped on purpose**. The changes are pure metadata
  exports (`Metadata` objects, `robots()`, `sitemap()`) and config
  (`pino.redact`, `experimental_telemetry`); none of them have a UI flow to
  drive. CLAUDE.md's verification rules permit substituting "the next best
  executable validation" for e2e in this case — the vitest above is that
  validation. Driving Cloudflare Insights' beacon-skip behavior would require
  a real browser + analytics origin, which adds complexity without raising
  confidence beyond the unit assertion.

## Schema

No DB schema change. No production rollout needed.

## Residual risks / follow-ups (not in this commit)

1. **CLI device flow structural fix.** The current change closes the
   Cloudflare-beacon and Referer leak channels, but the `session_id` is still
   in the URL query and the `/api/cli/auth/poll` endpoint is still
   unauthenticated. The full RFC 8628 split (separate `device_code` /
   `user_code`, PKCE-bound polling) remains a follow-up.
2. **Search Console cleanup.** Any share tokens already crawled before today
   need to be removed via GSC and the affected rows' tokens rotated. Not
   doable from code — operator action.
3. **Other audit findings deferred.** OAuth open registration, AUTH_SECRET
   default, bookmarks SSRF, and `AUTH_BYPASS` production guard — see the
   security audit report. Each is a separate change with its own scope.
