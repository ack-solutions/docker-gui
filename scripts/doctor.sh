#!/usr/bin/env bash
#
# docker-gui doctor — diagnose your installation.
#
# Usage:
#   ./scripts/doctor.sh                    # Run all checks
#   ./scripts/doctor.sh --json             # JSON output (for CI / monitoring)
#   ./scripts/doctor.sh --feature docker   # Run only docker checks
#
# Exits 0 if all checks pass, 1 if any failed.

set -uo pipefail

INSTALL_DIR="${DOCKER_GUI_DIR:-/opt/docker-gui}"
WEB_PORT="${DOCKER_GUI_WEB_PORT:-3000}"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-4000}"

# ---------- output formatting ----------

JSON_MODE=0
FEATURE=""
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    --feature) FEATURE="next" ;;
    *) [[ "$FEATURE" == "next" ]] && FEATURE="$arg" || true ;;
  esac
done

PASS=()
FAIL=()
WARN=()

ok()   { PASS+=("$1"); [[ $JSON_MODE -eq 0 ]] && printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
fail() { FAIL+=("$1: $2"); [[ $JSON_MODE -eq 0 ]] && printf '  \033[0;31m✗\033[0m %s — %s\n' "$1" "$2"; }
warn() { WARN+=("$1: $2"); [[ $JSON_MODE -eq 0 ]] && printf '  \033[0;33m⚠\033[0m %s — %s\n' "$1" "$2"; }
section() { [[ $JSON_MODE -eq 0 ]] && printf '\n\033[1;34m== %s ==\033[0m\n' "$1"; }

run_section() {
  local name=$1
  if [[ -n "$FEATURE" && "$FEATURE" != "$name" ]]; then return 1; fi
  return 0
}

# ---------- OS checks ----------

if run_section os; then
  section "OS"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    ok "Linux"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    ok "macOS"
  else
    fail "OS" "unsupported ($OSTYPE)"
  fi
fi

# ---------- Docker checks ----------

if run_section docker; then
  section "Docker"

  if command -v docker >/dev/null 2>&1; then
    ok "docker CLI ($(docker --version | head -1))"
  else
    fail "docker CLI" "not installed (https://docs.docker.com/engine/install/)"
  fi

  if docker info >/dev/null 2>&1; then
    ok "docker daemon running"
  else
    fail "docker daemon" "not reachable (sudo systemctl start docker)"
  fi

  if docker compose version >/dev/null 2>&1; then
    ok "docker compose plugin"
  else
    fail "docker compose" "plugin missing (apt install docker-compose-plugin)"
  fi

  # Socket reachable from this user
  if [[ -r /var/run/docker.sock ]]; then
    ok "docker socket readable (/var/run/docker.sock)"
  elif [[ -r "$HOME/.docker/run/docker.sock" ]]; then
    ok "docker socket readable (~/.docker/run/docker.sock — Docker Desktop)"
  else
    warn "docker socket" "not readable by current user — may need sudo or 'docker' group membership"
  fi
fi

# ---------- system resources ----------

if run_section system; then
  section "System"

  # Memory available
  if command -v free >/dev/null 2>&1; then
    mem_avail_mb=$(free -m | awk '/^Mem:/ {print $7}')
    if [[ -n "$mem_avail_mb" && "$mem_avail_mb" -ge 512 ]]; then
      ok "memory ${mem_avail_mb} MB available"
    else
      warn "memory" "only ${mem_avail_mb:-unknown} MB available — recommend 1+ GB"
    fi
  fi

  # Disk space
  disk_avail_gb=$(df -BG / 2>/dev/null | awk 'NR==2 {gsub("G","",$4); print $4}')
  if [[ -n "$disk_avail_gb" && "$disk_avail_gb" -ge 5 ]]; then
    ok "disk ${disk_avail_gb} GB free at /"
  elif [[ -n "$disk_avail_gb" ]]; then
    warn "disk" "only ${disk_avail_gb} GB free at / — recommend 10+ GB"
  fi

  # Required commands
  for cmd in curl openssl; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ok "$cmd installed"
    else
      fail "$cmd" "not installed"
    fi
  done
fi

# ---------- ports ----------

if run_section ports; then
  section "Ports"

  for port in "$WEB_PORT" "$API_PORT"; do
    if command -v ss >/dev/null 2>&1; then
      bound=$(ss -tnlp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $1; exit}')
    elif command -v lsof >/dev/null 2>&1; then
      bound=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk -v p="$port" '$9 ~ p { print "LISTEN"; exit }')
    fi
    if [[ -z "${bound:-}" ]]; then
      ok "port $port free"
    elif [[ -d "$INSTALL_DIR" ]]; then
      ok "port $port in use (probably docker-gui)"
    else
      warn "port $port" "in use by another process"
    fi
  done
fi

# ---------- service ----------

if run_section service; then
  section "Service"

  if [[ -d "$INSTALL_DIR" ]]; then
    ok "install dir exists ($INSTALL_DIR)"
  else
    warn "install dir" "$INSTALL_DIR not found — run install.sh first"
  fi

  if [[ -f "$INSTALL_DIR/.env" ]]; then
    perms=$(stat -c '%a' "$INSTALL_DIR/.env" 2>/dev/null || stat -f '%Lp' "$INSTALL_DIR/.env" 2>/dev/null)
    if [[ "${perms:-}" == "600" ]]; then
      ok ".env present (mode 600)"
    else
      warn ".env" "permissions are ${perms:-unknown}, recommend 600"
    fi

    # Validate required vars
    if grep -q '^JWT_SECRET=.\{32,\}' "$INSTALL_DIR/.env"; then
      ok "JWT_SECRET set (32+ chars)"
    else
      fail "JWT_SECRET" "missing or too short in .env"
    fi
    if grep -q '^SETUP_SECRET=.\{16,\}' "$INSTALL_DIR/.env"; then
      ok "SETUP_SECRET set"
    else
      fail "SETUP_SECRET" "missing or too short in .env"
    fi
  fi

  if [[ -f "$INSTALL_DIR/config.yml" ]]; then
    ok "config.yml present"
  else
    warn "config.yml" "missing — run docker-gui restart to recreate from template"
  fi

  if [[ -x /usr/local/bin/docker-gui ]]; then
    ok "docker-gui CLI installed (/usr/local/bin/docker-gui)"
  else
    warn "docker-gui CLI" "not installed — run sudo cp $INSTALL_DIR/source/scripts/cli.sh /usr/local/bin/docker-gui"
  fi

  # Live endpoint
  if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/v1/health/live" >/dev/null 2>&1; then
    ok "API /health/live responds"
  else
    warn "API /health/live" "not responding on :$WEB_PORT (service may be starting or down)"
  fi

  # Full health
  health_json=$(curl -fsS "http://127.0.0.1:${WEB_PORT}/api/v1/health" 2>/dev/null || true)
  if [[ -n "$health_json" ]]; then
    overall=$(echo "$health_json" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p' | head -1)
    if [[ "$overall" == "ok" ]]; then
      ok "overall status: ok"
    elif [[ "$overall" == "degraded" ]]; then
      warn "overall status" "degraded — see /health"
    elif [[ -n "$overall" ]]; then
      fail "overall status" "$overall"
    fi
  fi
fi

# ---------- Caddy ----------

if run_section caddy; then
  section "Caddy (reverse proxy)"

  caddy_running=0
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^docker-gui-caddy$'; then
    ok "container running"
    caddy_running=1
  else
    warn "container" "docker-gui-caddy not running (Caddy is optional in dev)"
  fi

  if [[ $caddy_running -eq 1 ]]; then
    if docker exec docker-gui-caddy wget -qO- --tries=1 --timeout=3 http://127.0.0.1:2019/ >/dev/null 2>&1; then
      ok "admin API reachable from inside container"
    else
      fail "admin API" "not responding inside docker-gui-caddy"
    fi
  fi

  # Check that the API can reach Caddy via the configured CADDY_ADMIN_URL
  if [[ -n "${health_json:-}" ]]; then
    if curl -fsS "http://127.0.0.1:${WEB_PORT}/api/v1/sites/status" \
         -H "authorization: Bearer ignored" 2>/dev/null \
         | grep -q '"caddyConfigured":true'; then
      ok "API has CADDY_ADMIN_URL configured"
    fi
  fi
fi

# ---------- output ----------

if [[ $JSON_MODE -eq 1 ]]; then
  printf '{"pass":%s,"fail":%s,"warn":%s,"checks":{"pass":[' "${#PASS[@]}" "${#FAIL[@]}" "${#WARN[@]}"
  for i in "${!PASS[@]}"; do
    [[ $i -gt 0 ]] && printf ','
    printf '"%s"' "${PASS[$i]//\"/\\\"}"
  done
  printf '],"fail":['
  for i in "${!FAIL[@]}"; do
    [[ $i -gt 0 ]] && printf ','
    printf '"%s"' "${FAIL[$i]//\"/\\\"}"
  done
  printf '],"warn":['
  for i in "${!WARN[@]}"; do
    [[ $i -gt 0 ]] && printf ','
    printf '"%s"' "${WARN[$i]//\"/\\\"}"
  done
  printf ']}}\n'
else
  echo
  echo "Summary:  ${#PASS[@]} passed  ${#WARN[@]} warned  ${#FAIL[@]} failed"
fi

if [[ ${#FAIL[@]} -gt 0 ]]; then
  exit 1
fi
exit 0
