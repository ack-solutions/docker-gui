#!/usr/bin/env bash
#
# docker-gui CLI — day-to-day operations.
#
# Installed by install.sh to /usr/local/bin/docker-gui.
# Run `docker-gui` with no arguments or with `--help` for usage.

set -euo pipefail

INSTALL_DIR="${DOCKER_GUI_DIR:-/opt/docker-gui}"
COMPOSE="docker compose -f $INSTALL_DIR/docker-compose.yml"

# ---------- helpers ----------

usage() {
  cat <<'EOF'
docker-gui — manage your docker-gui install

Usage:  docker-gui <command> [args...]

Service:
  start                     Start the stack (api + web + caddy)
  stop                      Stop everything
  restart                   Restart everything (re-reads config.yml)
  status                    Show running services
  logs [service]            Tail logs (all services, or one of: api|web|caddy)
  shell [service]           Open a shell in a running container (default: api)

Config:
  config                    Open config.yml in $EDITOR (default: nano)
  config show               Print the merged config (yaml + env)
  config validate           Check config.yml for syntax errors

Admin:
  admin reset <email> <password>   Reset a user's password
  admin create <email> <name> <password>  Create a new admin user
  admin list                        List all users

Backup:
  backup [--out path]       Tarball the data volume to <path> (default: ./docker-gui-backup-<date>.tar.gz)
  restore <path>            Restore a backup tarball into the data volume

Maintenance:
  update [--version v]      Pull/rebuild latest version. --version optional (default: main)
  doctor [--feature x]      Run health diagnostics
  rollback                  Restore the previous version (if update kept a snapshot)

Removal:
  uninstall [--keep-data]   Stop and remove (use --purge to wipe data too)

Other:
  version                   Print version + image tags
  --help, -h                Show this help
EOF
}

require_install() {
  if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "docker-gui is not installed in $INSTALL_DIR." >&2
    echo "Install with: curl -fsSL https://get.docker-gui.io/install.sh | sudo bash" >&2
    exit 1
  fi
}

require_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "This command requires root: sudo $0 $*" >&2
    exit 1
  fi
}

# ---------- commands ----------

cmd_start()    { require_install; cd "$INSTALL_DIR" && $COMPOSE up -d; }
cmd_stop()     { require_install; cd "$INSTALL_DIR" && $COMPOSE down; }
cmd_restart()  { require_install; cd "$INSTALL_DIR" && $COMPOSE restart; }
cmd_status()   { require_install; cd "$INSTALL_DIR" && $COMPOSE ps; }

cmd_logs() {
  require_install
  cd "$INSTALL_DIR"
  if [[ $# -gt 0 ]]; then
    $COMPOSE logs -f --tail=200 "$@"
  else
    $COMPOSE logs -f --tail=200
  fi
}

cmd_shell() {
  require_install
  local svc="${1:-api}"
  cd "$INSTALL_DIR" && $COMPOSE exec "$svc" sh
}

cmd_config() {
  require_install
  if [[ "${1:-}" == "show" ]]; then
    cat "$INSTALL_DIR/config.yml"
    return
  fi
  if [[ "${1:-}" == "validate" ]]; then
    if command -v yq >/dev/null 2>&1; then
      yq eval '.' "$INSTALL_DIR/config.yml" >/dev/null && echo "config.yml is valid YAML."
    else
      python3 -c "import yaml,sys; yaml.safe_load(open('$INSTALL_DIR/config.yml')); print('config.yml is valid YAML.')" \
        || { echo "config.yml has invalid YAML." >&2; exit 1; }
    fi
    return
  fi
  ${EDITOR:-nano} "$INSTALL_DIR/config.yml"
  echo
  echo "Reloading config…"
  cmd_restart
}

cmd_admin() {
  require_install
  cd "$INSTALL_DIR"
  case "${1:-}" in
    reset)
      [[ $# -eq 3 ]] || { echo "Usage: docker-gui admin reset <email> <password>" >&2; exit 1; }
      $COMPOSE exec api npx tsx /app/scripts/admin-reset.ts "$2" "$3"
      ;;
    create)
      [[ $# -eq 4 ]] || { echo "Usage: docker-gui admin create <email> <name> <password>" >&2; exit 1; }
      $COMPOSE exec api npx tsx /app/scripts/admin-create.ts "$2" "$3" "$4"
      ;;
    list)
      $COMPOSE exec api npx tsx /app/scripts/admin-list.ts
      ;;
    *)
      echo "Usage: docker-gui admin {reset|create|list} ..." >&2
      exit 1
      ;;
  esac
}

cmd_backup() {
  require_install
  local out="docker-gui-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out) out="$2"; shift 2;;
      *) echo "Unknown option: $1" >&2; exit 1;;
    esac
  done
  echo "==> Backing up data volume to $out"
  docker run --rm \
    -v docker-gui_app-data:/data:ro \
    -v "$(dirname "$(realpath "$out")"):/backup" \
    alpine tar czf "/backup/$(basename "$out")" -C /data .
  echo "==> Backup complete: $out"
}

cmd_restore() {
  require_install
  local file="${1:?Usage: docker-gui restore <backup.tar.gz>}"
  [[ -f "$file" ]] || { echo "File not found: $file" >&2; exit 1; }
  echo "==> Restoring from $file"
  echo "    This will REPLACE the current database. Backup current state first if unsure."
  read -r -p "Continue? [y/N] " ans
  [[ "$ans" =~ ^[yY] ]] || { echo "Aborted."; exit 1; }
  cd "$INSTALL_DIR" && $COMPOSE down
  docker run --rm \
    -v docker-gui_app-data:/data \
    -v "$(dirname "$(realpath "$file")"):/backup:ro" \
    alpine sh -c "rm -rf /data/* /data/.* 2>/dev/null; tar xzf /backup/$(basename "$file") -C /data"
  cd "$INSTALL_DIR" && $COMPOSE up -d
  echo "==> Restore complete."
}

cmd_update() {
  require_install
  require_root "$@"
  local version="${DOCKER_GUI_VERSION:-main}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version) version="$2"; shift 2;;
      *) echo "Unknown option: $1" >&2; exit 1;;
    esac
  done
  echo "==> Updating to: $version"
  DOCKER_GUI_VERSION="$version" \
  DOCKER_GUI_DIR="$INSTALL_DIR" \
    bash -c '
      set -e
      installer="$DOCKER_GUI_DIR/source/scripts/install.sh"
      if [[ -x "$installer" ]]; then
        bash "$installer"
      else
        # Fallback to fetching the installer fresh
        curl -fsSL "${DOCKER_GUI_INSTALLER_URL:-https://get.docker-gui.io/install.sh}" | bash
      fi
    '
}

cmd_doctor() {
  require_install
  bash "$INSTALL_DIR/source/scripts/doctor.sh" "$@"
}

cmd_uninstall() {
  require_install
  require_root "$@"
  bash "$INSTALL_DIR/source/scripts/uninstall.sh" "$@"
}

cmd_version() {
  require_install
  cd "$INSTALL_DIR"
  echo "Install dir:  $INSTALL_DIR"
  if [[ -f "$INSTALL_DIR/source/package.json" ]]; then
    local v
    v=$(grep -m1 '"version"' "$INSTALL_DIR/source/package.json" | cut -d'"' -f4)
    echo "Source ver:   ${v:-unknown}"
  fi
  echo "Containers:"
  $COMPOSE ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' 2>/dev/null || true
}

# ---------- dispatch ----------

case "${1:-}" in
  ""|--help|-h|help) usage ;;
  start)             shift; cmd_start "$@" ;;
  stop)              shift; cmd_stop "$@" ;;
  restart)           shift; cmd_restart "$@" ;;
  status|ps)         shift; cmd_status "$@" ;;
  logs)              shift; cmd_logs "$@" ;;
  shell|exec)        shift; cmd_shell "$@" ;;
  config)            shift; cmd_config "$@" ;;
  admin)             shift; cmd_admin "$@" ;;
  backup)            shift; cmd_backup "$@" ;;
  restore)           shift; cmd_restore "$@" ;;
  update|upgrade)    shift; cmd_update "$@" ;;
  doctor)            shift; cmd_doctor "$@" ;;
  uninstall)         shift; cmd_uninstall "$@" ;;
  version|--version) shift; cmd_version "$@" ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Run 'docker-gui --help' for usage." >&2
    exit 1
    ;;
esac
