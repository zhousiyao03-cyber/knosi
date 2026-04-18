#!/usr/bin/env bash
set -euo pipefail

# Fresh-server bootstrap for the Knosi stack on Hetzner.
# End state:
#   - k3s cluster (single node, Traefik disabled; we run our own)
#   - systemd Caddy on :80 / :443 → reverse-proxy into Traefik :30080
#   - Traefik installed separately via helm (see ops/k3s/README.md)
#   - nerdctl + buildkitd for building images directly into k3s' containerd
#   - swap file so the host can survive transient memory spikes
#
# Re-running is safe; every step is idempotent.

SWAP_GB="${1:-4}"
NERDCTL_VERSION="${NERDCTL_VERSION:-2.0.3}"
BUILDKIT_VERSION="${BUILDKIT_VERSION:-0.18.2}"

if ! [[ "$SWAP_GB" =~ ^[0-9]+$ ]] || [ "$SWAP_GB" -lt 1 ]; then
  echo "swap size must be a positive integer in GB" >&2
  exit 1
fi

# --- swap ---
if ! swapon --show | grep -q '^/swapfile '; then
  rm -f /swapfile
  if ! fallocate -l "${SWAP_GB}G" /swapfile 2>/dev/null; then
    dd if=/dev/zero of=/swapfile bs=1G count="$SWAP_GB" status=progress
  fi
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi

if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- apt packages ---
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates cron curl git gnupg rsync ufw

# --- Caddy (systemd) ---
if ! command -v caddy >/dev/null 2>&1; then
  curl -sL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -sL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# --- k3s ---
if ! systemctl is-active --quiet k3s; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="\
    --disable=traefik \
    --disable=servicelb \
    --write-kubeconfig-mode=644" sh -
fi

# --- nerdctl + buildkit (replaces docker for image builds into k3s containerd) ---
if ! command -v nerdctl >/dev/null 2>&1; then
  curl -fsSL "https://github.com/containerd/nerdctl/releases/download/v${NERDCTL_VERSION}/nerdctl-${NERDCTL_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /usr/local/bin nerdctl
fi

if ! command -v buildkitd >/dev/null 2>&1; then
  curl -fsSL "https://github.com/moby/buildkit/releases/download/v${BUILDKIT_VERSION}/buildkit-v${BUILDKIT_VERSION}.linux-amd64.tar.gz" \
    | tar -xz -C /usr/local
fi

mkdir -p /etc/nerdctl
cat >/etc/nerdctl/nerdctl.toml <<'EOF'
address = "/run/k3s/containerd/containerd.sock"
namespace = "k8s.io"
EOF

cat >/etc/systemd/system/buildkitd.socket <<'EOF'
[Unit]
Description=BuildKit socket

[Socket]
ListenStream=/run/buildkit/buildkitd.sock
SocketMode=0660

[Install]
WantedBy=sockets.target
EOF

cat >/etc/systemd/system/buildkitd.service <<'EOF'
[Unit]
Description=BuildKit (rootful, for nerdctl build)
Requires=buildkitd.socket
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/buildkitd --addr unix:///run/buildkit/buildkitd.sock

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /run/buildkit
systemctl daemon-reload
systemctl enable --now buildkitd.socket
systemctl enable --now buildkitd.service
systemctl enable --now cron

# --- sysctl ---
cat >/etc/sysctl.d/99-knosi.conf <<'EOF'
vm.overcommit_memory = 1
EOF
sysctl --system >/dev/null

# --- firewall ---
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- app directory ---
install -d -m 755 /srv/knosi
install -d -m 755 /srv/knosi/runtime

echo "bootstrap complete"
echo ""
echo "Next steps:"
echo "  1. Copy .env.production into /srv/knosi/"
echo "  2. Install Traefik via helm (see ops/k3s/README.md § First-time bootstrap)"
echo "  3. Copy ops/hetzner/Caddyfile to /etc/caddy/Caddyfile and 'systemctl reload caddy'"
echo "  4. Push to main to trigger deploy.sh"
