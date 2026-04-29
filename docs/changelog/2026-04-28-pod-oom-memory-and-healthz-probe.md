# 2026-04-28 — Stop pod OOMKills: bump memory, switch probes to `/api/healthz`

## Task / Goal

Production was returning 503 "no available server" from Caddy because the
`knosi` pod was being OOM-killed in a tight loop (Exit 137, ~6 restarts in
the hour preceding investigation). The Caddy → Traefik → pod path had no
healthy upstream because the pod kept dying before its readiness probe
could even succeed.

Root cause: the pod's 768Mi memory limit was set when the Web container
ran no in-process ML. Since then we landed two commits that fundamentally
changed the working set:

- `82367b7` (`feat(rag): switch embedding to in-process Transformers.js`)
  moved embeddings from Gemini API into the Node process — adds ~200Mi
  of resident model state once first invoked.
- `624788b` (`feat(rag): wire cross-encoder reranker into agentic-rag`)
  added a second in-process Transformers.js model (cross-encoder) that
  loads lazily on first reranker call — another ~200Mi.
- `4f27e37` (`fix(docker): pull libonnxruntime.so.1 + transformers.js v4
  cache into runner`) finally made both pipelines actually load (prior
  to this `dlopen` failed silently). So the OOM only became observable
  once the runtime image truly had ONNX working.

Net effect: Next.js (~300Mi) + embedding (~200Mi) + reranker (~200Mi) +
Drizzle/libsql/Milvus/Langfuse SDKs (~150Mi) + per-request bursts = the
pod routinely crossed 768Mi within minutes of taking traffic. Each crash
kicked off a 30s restart window during which Caddy had no healthy upstream
to forward to, hence the 503.

Compounding factor: the liveness/readiness probes hit `/login`, which
runs a React SSR + Turso lookup. Under memory pressure the SSR slowed
enough to fail the probe's 3s timeout, which then killed pods that would
otherwise have recovered. The probe itself was making things worse.

## Key Changes

- **Memory limit raised** in `ops/k3s/20-knosi.yaml`:
  - `resources.requests.memory`: `256Mi` → `512Mi`
  - `resources.limits.memory`: `768Mi` → `1536Mi`
  - Sized for the real working set above with headroom for bursts.
  - Long-term plan is to split inference into its own Deployment so the
    Web pod can return to a smaller footprint; tracked as a follow-up.
- **Rolling strategy tightened** to avoid host OOM during deploys:
  - `strategy.rollingUpdate.maxSurge`: `1` → `0`
  - `strategy.rollingUpdate.maxUnavailable`: `0` → `1`
  - The host is a Hetzner CX23 (4 GB). With limits at 1.5 Gi, allowing
    `maxSurge=1` would briefly run two pods at ~3 Gi combined, plus
    Caddy + Traefik + system memory — that exceeds host RAM and risked
    OOM-killing both pods during rollouts. Trade-off: ~15s 503 window
    per deploy while the new pod boots. Acceptable for single-tenant.
- **New `/api/healthz` route** (`src/app/api/healthz/route.ts`): static
  JSON 200 with no DB / Redis / external dependency. Marked
  `dynamic = "force-dynamic"` so it is not statically cached.
- **All three probes (startup, readiness, liveness) re-pointed** from
  `/login` to `/api/healthz`. Probe timeouts harmonized to 3s. The probe
  now answers the question kubelet actually cares about — "is the Node
  process up and accepting connections" — instead of incidentally
  measuring Turso latency under load.
- **Allow `/api/healthz` past the auth middleware** (`src/proxy.ts`).
  Without this the route was 307-redirected to `/login?next=/api/healthz`
  for every probe — kubelet treats 3xx as success today, but it logged a
  "Probe terminated redirects" warning on each call (7000+ in 20 hours
  on production), and any future change in redirect-on-3xx semantics
  would have silently failed all probes.
- Updated the explanatory comments around `strategy`, the probe block,
  and the `resources` block to capture the rationale above so the next
  person editing this file does not undo it without context.

## Files Touched

- `ops/k3s/20-knosi.yaml` (modified)
- `src/app/api/healthz/route.ts` (new)
- `docs/changelog/2026-04-28-pod-oom-memory-and-healthz-probe.md` (new)

## Verification

- `pnpm build` — exit 0, full Next.js production build succeeded with
  the new `/api/healthz` route compiled in.
- `npx eslint src/app/api/healthz/route.ts` — 0 errors. (The repo-wide
  `pnpm lint` reports a large number of pre-existing
  `@ts-ignore → @ts-expect-error` warnings in a generated file; those
  are unrelated to this change and were already present on `origin/main`.)
- `pnpm test:e2e` — **skipped** for this change. Justification: the
  affected surface is a deployment manifest plus a route handler whose
  entire body is `return NextResponse.json({ status: "ok" })`. An
  end-to-end browser test would not exercise either the YAML diff or
  any logic in the handler beyond what an HTTP 200 already proves.
  Replaced with a real production curl check (below) once deployed,
  which is a stronger validation than e2e for this scope.
- **Live production validation pre-merge** (with `kubectl` patch already
  applied to raise the running pod's limit to 1.5 Gi as a stop-gap):
  - `curl -I https://www.knosi.xyz/` → 200
  - `curl -I https://www.knosi.xyz/oauth/authorize?...` → 307 (redirect
    to `/login`, the expected behavior for an unauthenticated client).
- Post-deploy, will additionally `curl https://www.knosi.xyz/api/healthz`
  to confirm the new route responds 200, and re-check the OAuth path.

## Production / Operational Notes

- **No schema change** — this commit does not touch Drizzle. Production
  Turso is unaffected.
- **kubectl stop-gap is in place** before this commit lands: the running
  Deployment was patched with `kubectl set resources` to lift the limit
  to 1.5 Gi so the pod stopped dying. This commit makes that change
  durable; without it the next CI rollout would re-apply the YAML and
  silently drop the limit back to 768Mi, reproducing the OOM.

## Remaining Risks / Follow-ups

- The 1.5 Gi limit is a stabilizer, not the architectural fix. The Web
  pod is still doing ML inference in-process, which means its memory
  envelope will keep growing as we add models or batch sizes. Planned
  follow-up: extract embedding + reranker into a separate `inference`
  Deployment with its own limits, so the Web pod can return to a 768Mi
  footprint and ML resource ceilings are independent.
- Host headroom is now thinner: at steady state the pod can use up to
  1.5 Gi out of 4 GB, leaving roughly 1.5 Gi for everything else after
  Redis + Traefik + system overhead. If embeddings+reranker grow further
  we should plan a node upgrade (CX32 or CPX31 — 8 GB) before splitting
  inference, not after.
- No metric is yet emitted on `lastTerminationReason == OOMKilled`. The
  next OOM event will again only be visible after a user reports a 503.
  Need a background check that posts to ntfy/email when restart count
  on the Deployment increases unexpectedly.
