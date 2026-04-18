#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/knosi}"
CADDYFILE_SRC="${CADDYFILE_SRC:-ops/hetzner/Caddyfile}"
CADDYFILE_DEST="${CADDYFILE_DEST:-/etc/caddy/Caddyfile}"
EXPECTED_STATUS="${EXPECTED_STATUS:-200}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"
NEXT_DEPLOYMENT_ID="${NEXT_DEPLOYMENT_ID:-$(date -u +%Y%m%d%H%M%S)}"
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}"
DEPLOYED_AT="${DEPLOYED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

IMAGE_NAME="knosi:latest"
K3S_NAMESPACE="knosi"
K3S_DEPLOYMENT="knosi"
KUBECONFIG_FILE="${KUBECONFIG_FILE:-/etc/rancher/k3s/k3s.yaml}"
K3S_HEALTHCHECK_URL="${K3S_HEALTHCHECK_URL:-http://127.0.0.1:30080/login}"
K3S_HEALTHCHECK_HOST="${K3S_HEALTHCHECK_HOST:-www.knosi.xyz}"

cd "$APP_DIR"

if [ ! -f ".env.production" ]; then
  echo "missing $APP_DIR/.env.production" >&2
  exit 1
fi

export NEXT_DEPLOYMENT_ID GIT_SHA DEPLOYED_AT KUBECONFIG="$KUBECONFIG_FILE"
echo "deploying with NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID GIT_SHA=${GIT_SHA:-unknown}"

# 1. Build the app image directly into k3s' containerd via nerdctl+buildkit.
#    nerdctl's default config (/etc/nerdctl/nerdctl.toml) points at
#    /run/k3s/containerd/containerd.sock with namespace k8s.io, so the
#    resulting image is immediately visible to the kubelet — no separate
#    `docker save | ctr images import` step needed.
nerdctl build --pull \
  --build-arg NEXT_DEPLOYMENT_ID="$NEXT_DEPLOYMENT_ID" \
  -t "$IMAGE_NAME" \
  .

# 2. Ensure namespace exists (idempotent)
kubectl apply -f ops/k3s/00-namespace.yaml

# 3. Refresh the Secret from .env.production so env changes propagate
kubectl -n "$K3S_NAMESPACE" create secret generic knosi-env \
  --from-env-file=.env.production \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Apply Deployments / Services / Ingress / PVCs
kubectl apply -f ops/k3s/10-redis.yaml
kubectl apply -f ops/k3s/20-knosi.yaml
kubectl apply -f ops/k3s/30-ingress.yaml

# 5. Roll the deployment so the freshly built image + secret are picked up
kubectl -n "$K3S_NAMESPACE" rollout restart deploy/"$K3S_DEPLOYMENT"
kubectl -n "$K3S_NAMESPACE" rollout status deploy/"$K3S_DEPLOYMENT" --timeout=300s

# 6. Sync Caddyfile and graceful-reload systemd caddy (edge TLS + reverse proxy)
if ! cmp -s "$CADDYFILE_SRC" "$CADDYFILE_DEST"; then
  cp "$CADDYFILE_SRC" "$CADDYFILE_DEST"
  systemctl reload caddy
  echo "Caddyfile changed → caddy reloaded"
else
  echo "Caddyfile unchanged → caddy left alone"
fi

# 7. End-to-end health check: public path through Caddy → Traefik → k3s pod
attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  status_code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $K3S_HEALTHCHECK_HOST" "$K3S_HEALTHCHECK_URL" || true)"
  if [ "$status_code" = "$EXPECTED_STATUS" ]; then
    kubectl -n "$K3S_NAMESPACE" get pod,svc,ingress
    exit 0
  fi

  echo "health check attempt $attempt/$MAX_ATTEMPTS returned $status_code" >&2
  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

kubectl -n "$K3S_NAMESPACE" logs deploy/"$K3S_DEPLOYMENT" --tail=100 >&2 || true
journalctl -u caddy --since "2 minutes ago" --no-pager | tail -30 >&2 || true
echo "deployment failed: $K3S_HEALTHCHECK_URL did not return $EXPECTED_STATUS" >&2
exit 1
