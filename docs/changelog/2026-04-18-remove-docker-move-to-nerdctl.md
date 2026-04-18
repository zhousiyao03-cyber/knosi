# 2026-04-18 — Retire Docker from the Hetzner host, reclaim ~1.2 GB RAM

## Goal

The Hetzner VPS (2C4G) was running with only 363 Mi `available` memory
and leaning on swap. Diagnosis showed `dockerd` itself was holding 778 MB
resident just to supervise a single Caddy container. Since the entire
application stack had already moved to k3s (2026-04-17 changelog), the
docker daemon had become pure overhead.

This changelog covers removing docker from the host entirely and
replacing the two things that still needed it:

- **Caddy reverse proxy** — moved into systemd as a first-class service
- **`docker build` in `deploy.sh`** — replaced with `nerdctl build`
  against k3s' own containerd (no second runtime, no `docker save |
  ctr images import` round-trip)

## Before / after

| Metric | Before | After |
|---|---|---|
| Memory `used` | 3.4 Gi | 2.3 Gi |
| Memory `available` | 363 Mi | 1.4 Gi |
| Swap used | 1.5 Gi | ~500 Mi (and trending down) |
| Daemons holding RAM | dockerd 778 MB + k3s 528 MB + caddy-in-docker ~25 MB | caddy(systemd) 46 MB + k3s 522 MB + buildkitd ~50 MB (idle) |
| Container runtimes on host | 2 (dockerd + k3s containerd) | 1 (k3s containerd) |

## What changed

### Caddy → systemd

Installed Caddy 2.11.2 from the official apt repo. Copied the existing
cert tree from `/var/lib/docker/volumes/knosi_caddy-data/_data/caddy/`
into `/var/lib/caddy/.local/share/caddy/` so Let's Encrypt didn't have
to re-issue anything. Stopped + removed `knosi-caddy-1`; stopped and
disabled `docker.service` + `docker.socket`.

- Caddyfile: switched `{$APP_DOMAIN}` / `{$ROOT_DOMAIN}` placeholders to
  the literal domains (no env-file injection in systemd), and switched
  the upstream from `172.17.0.1:30080` (docker bridge gateway) to
  `127.0.0.1:30080` (systemd sees the host directly).
- All three Let's Encrypt certs (`www`, `knosi`, `k3s`, `plausible`) reloaded
  into systemd Caddy without re-issue.

### docker build → nerdctl build

Installed `nerdctl 2.0.3` + `buildkitd 0.18.2` (systemd socket + service).
nerdctl default config at `/etc/nerdctl/nerdctl.toml` points at
`/run/k3s/containerd/containerd.sock` with namespace `k8s.io`, so
`nerdctl build -t knosi:latest .` lands the image directly where the
kubelet can see it.

This simplifies `deploy.sh` — `docker save | k3s ctr images import -`
is gone.

### deploy.sh

Full rewrite. The pipeline is now:

1. `nerdctl build -t knosi:latest .` (into k3s containerd directly)
2. `kubectl apply` namespace / secret / deployments / ingress
3. `kubectl rollout restart deploy/knosi` + `rollout status`
4. `cmp -s Caddyfile` + `systemctl reload caddy` only if it changed
5. End-to-end smoke test via Caddy → Traefik → Pod (`Host: www.knosi.xyz`)

### bootstrap.sh

Rewrote for the new world. Previously assumed docker + compose; now installs:
- Caddy (apt)
- k3s with Traefik / servicelb disabled (we run Traefik separately via helm)
- nerdctl + buildkitd
- swap, sysctl (`vm.overcommit_memory=1`), ufw (80/443 only)

Each section is idempotent — re-running is safe.

### Plausible side-tune (also today)

- Tightened the `clickhouse-config` ConfigMap:
  `max_server_memory_usage=512M` (hard cap, replaces ratio-based knob
  that depended on cgroup limit which was only 768M, causing a
  MEMORY_LIMIT_EXCEEDED on simple counts),
  `mark_cache_size=128 MB`, `uncompressed_cache_size=0`,
  `max_memory_usage=350 MB` per query.
- Plausible `ELIXIR_ERL_OPTIONS=+SDio 1 +zdbbl 256`, `ERL_MAX_PORTS=1024`
  — shaved ~15 MB off the BEAM VM.

These are smaller than the docker removal (50 MB combined vs 1.2 GB)
but worth having.

## Files touched

- `docker-compose.prod.yml` — **removed**
- `ops/hetzner/Caddyfile` — modernised (systemd-friendly, no env vars)
- `ops/hetzner/deploy.sh` — rewritten (nerdctl + systemd caddy)
- `ops/hetzner/bootstrap.sh` — rewritten (no docker, installs k3s + caddy + nerdctl)
- `docs/changelog/2026-04-18-remove-docker-move-to-nerdctl.md` — this file

## Verification

| Check | Command | Result |
|---|---|---|
| docker fully gone | `systemctl is-active docker` | `inactive` |
| Caddy on :80/:443 | `ss -tlnp | grep -E ':(80|443)'` | served by systemd `caddy` PID |
| Cert re-use (no re-issue) | `openssl s_client \| openssl x509 -dates` | `notBefore=Apr 15 2026`, same as before migration |
| Public hosts reachable | `curl -I https://{www,,k3s,plausible}.knosi.xyz` | all `200 / 301` |
| deploy.sh end-to-end | manual run on server | 8m12s first run (buildkit cold), rollout succeeded, smoke test passed |
| Image built directly into k3s | `nerdctl images \| grep knosi` | `knosi:latest` visible from k8s namespace immediately after `nerdctl build` |
| Secret refresh still works | `kubectl -n knosi get secret knosi-env` | `Data: 37` |
| k3s Pods healthy | `kubectl -n knosi get pod` | `knosi` + `redis` 1/1 Running |

## Remaining risks / follow-ups

- **CI/CD server must have nerdctl + buildkit** — the new `deploy.sh`
  assumes they're on PATH. This host has them now; any fresh server
  needs `bootstrap.sh` to run first.
- **docker-compose.yml (dev)** kept intentionally — it's the
  "Option A: Docker self-hosting" path in the README for anyone cloning
  the project locally. Only the production variant was retired.
- **buildkitd ~300 MB during build, ~50 MB idle** — acceptable, but if
  it becomes a problem we can switch to `buildkitd --oci-worker-gc
  --oci-worker-gc-keepstorage 1G` or stop + start it around deploys.
- **`/etc/caddy/Caddyfile` is copied by `deploy.sh`** (not symlinked to
  the repo path). If someone edits it manually on the server it will be
  overwritten on next deploy. This is intentional — the repo is source
  of truth — but worth noting.
- The Plausible `max_memory_usage=350 MB` is a practical floor for
  ClickHouse, not a theoretical one. Going below this caused a
  `MEMORY_LIMIT_EXCEEDED` on a simple `SELECT count(*)`. If Plausible
  workloads grow (more events ingested), this ceiling may need raising
  — at which point we've already reclaimed enough RAM to afford it.
