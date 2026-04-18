# 2026-04-18 — Drop Plausible, switch to Cloudflare Web Analytics

## Goal

Plausible had been deployed on k3s (CX23, 2vCPU / 4GB) a day earlier but never
worked. The `plausible` pod was in `CrashLoopBackOff` because it could not run
its Ecto migrations against ClickHouse, and the `clickhouse` pod was stuck at
`0/1 Ready`. Investigation showed a classic death spiral: ClickHouse was CPU
limited to 1 core and hammering the local-path PVC at ~300 MB/s, the readiness
/ liveness probes were set to `timeoutSeconds: 1`, and the node hit
`load average 51` with 27% iowait. Every probe failure killed the container,
and the MergeTree recovery on restart re-triggered the same storm.

A 2vCPU / 4GB box cannot reasonably run ClickHouse + Plausible + Postgres
alongside the app + Redis + Traefik + buildkitd. Rather than tune limits,
drop the whole stack and use Cloudflare Web Analytics (manual JS Snippet
mode — the apex record is DNS-only, not proxied, so CF auto-injection is not
an option).

## Key changes

- Removed `plausible` namespace from k3s (pods, services, PVCs, ingress, secret).
- Deleted `ops/k3s/40-plausible.yaml` from the repo and `/srv/knosi/ops/k3s/`.
- Removed the `plausible.knosi.xyz` reverse-proxy block from
  `ops/hetzner/Caddyfile` so the edge no longer advertises a dead host.
- Replaced the Plausible `<Script>` tags in `src/app/layout.tsx` with the
  Cloudflare Insights beacon (token `77230078425f404aa623df2e0c39e471`, issued
  by the `knosi.xyz` site configured as "Enable with JS Snippet installation"
  — required because DNS is DNS-only on Cloudflare, not proxied).

## Files touched

- `ops/k3s/40-plausible.yaml` (deleted)
- `ops/hetzner/Caddyfile`
- `src/app/layout.tsx`

## Verification

- `kubectl get ns plausible` → `Terminating` (PVCs reclaimed by local-path).
- `free -h` on the node: memory back to ~1.8 Gi available, load average
  dropping from 51 to ~21 within minutes of deletion.
- `pnpm build` → clean (includes the CF beacon in the rendered tree).
- `pnpm lint` → 0 errors, 8 pre-existing warnings unchanged.
- E2E skipped: the change is a single external `<script>` tag, no UI flow
  or business logic touched. Beacon delivery will be verified post-deploy by
  loading knosi.xyz and watching the CF Web Analytics dashboard.

## Follow-ups

- In Cloudflare Web Analytics, delete the older "Automatic setup" site for
  `knosi.xyz` — it never received data because the hostname is DNS-only.
- Remove the `plausible.knosi.xyz` DNS record in the Cloudflare DNS tab.
- No production schema changes in this task.
