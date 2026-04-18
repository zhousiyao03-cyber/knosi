# 2026-04-18 — Plausible Analytics self-hosted on k3s

## Goal
Stand up privacy-friendly visitor analytics so we can finally see who is using
knosi.xyz (PV/UV, realtime, top pages, sources, devices) without sending data
to a third-party SaaS.

## Architecture
```
browser
  ↓ HTTPS (Let's Encrypt, auto-managed by Caddy)
Caddy on host  →  Traefik NodePort 30080  →  ingress (plausible ns)
                                          →  plausible:8000 (Phoenix app)
                                          ├→ postgres:5432  (app DB)
                                          └→ clickhouse:8123 (events DB)
```
- Subdomain: `plausible.knosi.xyz` (Cloudflare A record, DNS-only / grey cloud
  so Caddy's HTTP-01 challenge can complete).
- Isolated `plausible` namespace so the stack can be removed without touching
  the `knosi` namespace.
- 4 GB single-node k3s — every container has explicit `resources.limits`,
  ClickHouse has `low-resource.xml` config tuned for the box.

## Key changes
- `ops/k3s/40-plausible.yaml` — new manifest:
  - Namespace `plausible`
  - Postgres 16-alpine + 2 Gi PVC
  - ClickHouse 24.12-alpine + 4 Gi PVC + ConfigMap with memory caps
  - Plausible Community Edition v3.0.1 with init containers waiting on both DBs
  - Service + Ingress (Traefik, `plausible.knosi.xyz`)
- `ops/hetzner/Caddyfile` — added a `plausible.knosi.xyz` site reverse-proxying
  to the same Traefik NodePort the rest of the apps use.
- `src/app/layout.tsx` — registered the Plausible tracking script via
  `next/script` (`afterInteractive`) plus the `window.plausible` queue stub so
  callers can fire custom events even before the script loads. Domain is
  `knosi.xyz`, the script bundle enables file-downloads, hash routing,
  outbound-links, pageview-props, revenue, and tagged-events.

## Gotchas hit during rollout
1. **Plausible v3 no longer auto-creates the ClickHouse database.** First boot
   crash-looped with `Database plausible_events_db does not exist`. Fix:
   ```bash
   kubectl -n plausible exec deployment/clickhouse -- \
     clickhouse-client --query 'CREATE DATABASE IF NOT EXISTS plausible_events_db'
   ```
   then delete the `plausible` pod so it re-runs migrations cleanly.
2. **`scp` + Docker bind mount inode trap.** scp atomically replaces the file
   (new inode), but the running Caddy container still saw the old inode of the
   bind-mounted Caddyfile. `docker exec caddy reload` reported
   `config is unchanged` even though the host file was correct. Fix: restart
   the Caddy container (`docker restart knosi-caddy-1`) so the bind mount
   re-resolves to the current inode.
3. **Cloudflare proxy must be OFF (grey cloud) for the new subdomain.** Caddy
   needs port 80 reachable for the HTTP-01 ACME challenge; CF orange cloud
   intercepts it.

## Configuration choices
- `DISABLE_REGISTRATION=invite_only` — first user (admin) can register,
  everyone else has to be invited from inside the app. Keeps random people
  from creating accounts on `plausible.knosi.xyz/register`.
- ClickHouse logging set to `warning` and query logs disabled to keep disk and
  memory pressure down on the 4 GB node.

## Verification
- `dig +short plausible.knosi.xyz @1.1.1.1` → `195.201.117.172` ✅
- `kubectl -n plausible get pods` → all 3 pods `Running` / `1/1 Ready` ✅
- `curl -sI https://plausible.knosi.xyz` from the server →
  `HTTP/2 302` redirecting to `/register` (Plausible up, TLS valid) ✅
- Plausible admin user created, site `knosi.xyz` added, tracking snippet
  copied into `layout.tsx` ✅
- `pnpm build` ✅ (no errors after running `pnpm install` to materialize the
  `@opentelemetry/semantic-conventions` dep that was in the lockfile but
  missing from `node_modules`)
- `pnpm lint` ✅ (0 errors, 8 pre-existing warnings unrelated to this change)
- E2E: not run for this change — it is a third-party `<script>` injection in
  the root layout, no app behavior changes. Will be observed in production via
  Plausible's realtime dashboard once the next deploy ships `layout.tsx`.

## Side cleanup
`pnpm install` removed unused packages that were declared but never imported
anywhere in `src/`:
- `@vercel/analytics`
- `@vercel/blob`
- `@vercel/functions`
- `@vercel/otel`
- `@vercel/speed-insights`

These were leftover from an earlier "maybe deploy on Vercel" exploration. The
production deploy is k3s on Hetzner, none of them were ever wired up.

## Production schema
N/A — Plausible owns its own Postgres + ClickHouse, nothing changes in the
Knosi Turso schema.

## Follow-ups
- After `git push` + `ops/hetzner/deploy.sh`, verify the realtime dashboard at
  `https://plausible.knosi.xyz` actually shows the next visit to
  `https://knosi.xyz`.
- Consider adding goals (signup, first-note-created, ask-ai-used) once we want
  funnel-style product metrics — Plausible supports this via the
  `window.plausible('Event Name')` queue we already wired up.
- Sentry + Uptime Kuma still on the backlog (intentionally deferred this round).
