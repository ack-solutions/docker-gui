#!/usr/bin/env bash
#
# docker-gui installer
#
# One-line install on a fresh Linux server:
#
#     curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
#
# What it does:
#   1. Detects OS, installs Docker if missing
#   2. Downloads the latest source tarball (no `git` needed, no clone)
#   3. Generates strong random secrets in /opt/docker-gui/.env
#   4. Builds + starts the Docker stack (api + web + caddy)
#   5. Installs the `docker-gui` CLI to /usr/local/bin
#   6. Prints your URL + the one-time setup secret
#
# Re-run safely to upgrade — existing data, secrets, and config are kept.

set -euo pipefail

# ---------- config ----------

INSTALL_DIR="${DOCKER_GUI_DIR:-/opt/docker-gui}"
SOURCE_DIR="$INSTALL_DIR/source"
REPO="${DOCKER_GUI_REPO:-anthropics/docker-gui}"
VERSION="${DOCKER_GUI_VERSION:-main}"
WEB_PORT="${DOCKER_GUI_WEB_PORT:-3000}"
TARBALL_URL="${DOCKER_GUI_TARBALL_URL:-https://github.com/${REPO}/archive/${VERSION}.tar.gz}"
LOCAL="${DOCKER_GUI_LOCAL:-0}"

# ---------- helpers ----------

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33m⚠\033[0m %s\n' "$*"; }
err()  { printf '  \033[0;31m✗\033[0m %s\n' "$*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "This script must run as root (sudo)."
    exit 1
  fi
}

detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macos"
  elif [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "${ID:-linux}"
  else
    echo "unknown"
  fi
}

# ---------- pre-flight ----------

OS="$(detect_os)"
log "Detected OS: $OS"

if [[ "$OS" == "macos" ]]; then
  warn "macOS detected. Production install is not supported on macOS."
  warn "For local dev on Mac, see docs/DEVELOPMENT.md."
  exit 1
fi
require_root

# ---------- Docker ----------

log "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found. Installing via get.docker.com..."
  curl -fsSL https://get.docker.com | sh
  ok "Docker installed"
else
  ok "Docker present ($(docker --version | head -1))"
fi

if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon not running. Starting..."
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose plugin missing. Install docker-compose-plugin and retry."
  exit 1
fi
ok "Docker daemon reachable"

# ---------- ports ----------

log "Checking ports"
for port in "$WEB_PORT" 80 443; do
  if ss -tnlp 2>/dev/null | awk '{print $4}' | grep -q ":${port}\$"; then
    if [[ -d "$INSTALL_DIR" ]]; then
      ok "port $port in use (probably docker-gui)"
    else
      err "Port $port is already in use. Stop the process or use --port to pick another."
      exit 1
    fi
  else
    ok "port $port free"
  fi
done

# ---------- download source ----------

log "Setting up $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/caddy"

if [[ "$LOCAL" == "1" ]]; then
  ok "DOCKER_GUI_LOCAL=1 — using current directory as source"
  CURRENT="$(pwd)"
  rm -rf "$SOURCE_DIR"
  mkdir -p "$SOURCE_DIR"
  # rsync if available; otherwise tar through stdin
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude=node_modules --exclude=.next --exclude=.git \
      --exclude='apps/api/data' --exclude='apps/api/node_modules' \
      "$CURRENT/" "$SOURCE_DIR/"
  else
    (cd "$CURRENT" && tar c \
      --exclude=node_modules --exclude=.next --exclude=.git \
      --exclude='apps/api/data' --exclude='apps/api/node_modules' \
      .) | tar x -C "$SOURCE_DIR"
  fi
else
  log "Downloading source ($TARBALL_URL)"
  TMP_TARBALL="$(mktemp -t docker-gui-XXXXXX.tar.gz)"
  trap 'rm -f "$TMP_TARBALL"' EXIT
  if ! curl -fsSL -o "$TMP_TARBALL" "$TARBALL_URL"; then
    err "Failed to download source from $TARBALL_URL"
    err ""
    err "While docker-gui is in alpha, the default public URL may not exist"
    err "yet. To proceed, choose one of:"
    err ""
    err "  1) Local source (recommended for first install):"
    err "       scp -r your-repo your-server:/tmp/docker-gui-src"
    err "       ssh your-server"
    err "       cd /tmp/docker-gui-src && DOCKER_GUI_LOCAL=1 sudo -E ./scripts/install.sh"
    err ""
    err "  2) Your own GitHub fork:"
    err "       sudo DOCKER_GUI_REPO=youruser/docker-gui ./install.sh"
    err ""
    err "  3) An explicit tarball URL:"
    err "       sudo DOCKER_GUI_TARBALL_URL=https://example.com/dgui.tar.gz ./install.sh"
    err ""
    err "Full guide: docs/INSTALL.md (Alpha install section)"
    exit 1
  fi
  ok "Downloaded $(du -h "$TMP_TARBALL" | cut -f1)"

  log "Extracting source"
  TMP_EXTRACT="$(mktemp -d -t docker-gui-XXXXXX)"
  trap 'rm -rf "$TMP_EXTRACT" "$TMP_TARBALL"' EXIT
  tar -xzf "$TMP_TARBALL" -C "$TMP_EXTRACT"
  EXTRACTED_ROOT="$(find "$TMP_EXTRACT" -mindepth 1 -maxdepth 1 -type d | head -1)"
  if [[ -z "$EXTRACTED_ROOT" ]]; then
    err "Tarball had no top-level directory"
    exit 1
  fi

  rm -rf "$SOURCE_DIR"
  mv "$EXTRACTED_ROOT" "$SOURCE_DIR"
  ok "Source unpacked to $SOURCE_DIR"
fi

# ---------- compose + config files ----------

log "Linking compose + config"
# docker-compose.yml is always refreshed from source (so structural updates
# take effect). Per-deployment customizations should go in
# docker-compose.override.yml.
cp -f "$SOURCE_DIR/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
cp -f "$SOURCE_DIR/docker/caddy/initial.json" "$INSTALL_DIR/caddy/initial.json"

# config.yml: only created if missing — preserves user edits across upgrades
if [[ ! -f "$INSTALL_DIR/config.yml" ]]; then
  cp "$SOURCE_DIR/config.yml" "$INSTALL_DIR/config.yml"
  ok "Wrote default config.yml"
else
  ok "Existing config.yml preserved"
fi

# ---------- secrets ----------

log "Configuring secrets"
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  SETUP_SECRET="$(openssl rand -hex 32)"
  cat > "$INSTALL_DIR/.env" <<EOF
# Generated by install.sh on $(date -Iseconds)
# Do not commit this file. Mode 600.
JWT_SECRET=$JWT_SECRET
SETUP_SECRET=$SETUP_SECRET
WEB_PORT=$WEB_PORT
EOF
  chmod 600 "$INSTALL_DIR/.env"
  ok "Generated .env (mode 600)"
else
  ok "Existing .env preserved"
fi

# ---------- build + start ----------

log "Building images (a few minutes the first time)"
cd "$INSTALL_DIR"
docker compose build

log "Starting stack"
docker compose up -d

# ---------- install CLI ----------

log "Installing CLI to /usr/local/bin/docker-gui"
install -m 0755 "$SOURCE_DIR/scripts/cli.sh" /usr/local/bin/docker-gui
ok "Run \`docker-gui --help\` to see commands"

# ---------- wait for ready ----------

log "Waiting for service health"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/v1/health/live" >/dev/null 2>&1; then
    ok "Service ready (took ${i}s of 60s budget)"
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY:-0}" != "1" ]]; then
  err "Service did not become healthy within 60 seconds."
  err "Logs:    docker-gui logs"
  err "Doctor:  docker-gui doctor"
  exit 1
fi

# ---------- finish ----------

SETUP_SECRET="$(grep '^SETUP_SECRET=' "$INSTALL_DIR/.env" | cut -d= -f2)"
HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -z "${HOST_IP:-}" ]] && HOST_IP="<your-server-ip>"

cat <<EOF

\033[1;32m╔══════════════════════════════════════════════════════════════════╗\033[0m
\033[1;32m║\033[0m  docker-gui is running                                            \033[1;32m║\033[0m
\033[1;32m╚══════════════════════════════════════════════════════════════════╝\033[0m

  URL:           http://${HOST_IP}:${WEB_PORT}
  Setup secret:  ${SETUP_SECRET}
                 (one-time use to create the first admin)

  CLI:           docker-gui --help
  Update:        docker-gui update
  Status:        docker-gui status
  Logs:          docker-gui logs
  Doctor:        docker-gui doctor
  Edit config:   docker-gui config

  Config dir:    $INSTALL_DIR

EOF
