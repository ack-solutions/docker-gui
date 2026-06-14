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
  update [--version v]      Update to the latest released tag (default), a specific
                            --version <tag>, or --channel main for bleeding edge.
                            Snapshots data first so 'rollback' can undo it.
  rollback                  Restore the most recent pre-update snapshot (data + version)
  doctor [--feature x]      Run health diagnostics

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

REPO="${DOCKER_GUI_REPO:-ack-solutions/docker-gui}"
SNAPSHOT_DIR="$INSTALL_DIR/snapshots"

# Resolve the newest published release tag, or empty if none.
resolve_latest_tag() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -E '"tag_name":' | head -1 \
    | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true
}

# Snapshot the data volume + record the installed version, before an update.
snapshot_before_update() {
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local dir="$SNAPSHOT_DIR/$ts"
  mkdir -p "$dir"
  echo "==> Snapshotting data volume → $dir/data.tar.gz"
  docker run --rm \
    -v docker-gui_app-data:/data:ro \
    -v "$dir:/backup" \
    alpine tar czf /backup/data.tar.gz -C /data . || { echo "Snapshot failed" >&2; return 1; }
  # Record the currently-installed source version for rollback.
  if [[ -f "$INSTALL_DIR/source/package.json" ]]; then
    grep -m1 '"version"' "$INSTALL_DIR/source/package.json" | cut -d'"' -f4 > "$dir/VERSION" || true
  fi
  # Keep only the last 3 snapshots.
  ls -1dt "$SNAPSHOT_DIR"/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
  echo "$dir"
}

cmd_update() {
  require_install
  require_root "$@"
  local version="" channel="tag"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version) version="$2"; channel="pinned"; shift 2;;
      --channel) channel="$2"; shift 2;;
      *) echo "Unknown option: $1" >&2; exit 1;;
    esac
  done

  # Resolve target version: explicit --version wins; --channel main = bleeding
  # edge; otherwise the latest published release tag (falling back to main).
  if [[ -z "$version" ]]; then
    if [[ "$channel" == "main" ]]; then
      version="main"
    else
      version="$(resolve_latest_tag)"
      if [[ -z "$version" ]]; then
        echo "No published release found — using 'main'. Pin with --version <tag>." >&2
        version="main"
      fi
    fi
  fi
  echo "==> Updating to: $version"

  # Safety net: snapshot before we touch anything.
  snapshot_before_update >/dev/null || { echo "Aborting update (snapshot failed)." >&2; exit 1; }

  if DOCKER_GUI_VERSION="$version" DOCKER_GUI_DIR="$INSTALL_DIR" \
      bash -c '
        set -e
        installer="$DOCKER_GUI_DIR/source/scripts/install.sh"
        if [[ -x "$installer" ]]; then bash "$installer"; else
          curl -fsSL "${DOCKER_GUI_INSTALLER_URL:-https://raw.githubusercontent.com/'"$REPO"'/main/scripts/install.sh}" | bash
        fi
      '; then
    echo "==> Update to $version complete. Roll back with: docker-gui rollback"
  else
    echo "✗ Update failed. Your data snapshot is safe in $SNAPSHOT_DIR." >&2
    echo "  Restore it with: docker-gui rollback" >&2
    exit 1
  fi
}

cmd_rollback() {
  require_install
  require_root "$@"
  local latest
  latest="$(ls -1dt "$SNAPSHOT_DIR"/*/ 2>/dev/null | head -1 || true)"
  [[ -n "$latest" && -f "$latest/data.tar.gz" ]] || {
    echo "No snapshot found in $SNAPSHOT_DIR — nothing to roll back to." >&2; exit 1; }
  local ver=""; [[ -f "$latest/VERSION" ]] && ver="$(cat "$latest/VERSION")"
  echo "==> Rolling back data from $latest${ver:+ (version $ver)}"
  echo "    This REPLACES the current database with the snapshot."
  read -r -p "Continue? [y/N] " ans
  [[ "$ans" =~ ^[yY] ]] || { echo "Aborted."; exit 1; }
  cd "$INSTALL_DIR" && $COMPOSE down
  docker run --rm \
    -v docker-gui_app-data:/data \
    -v "$latest:/backup:ro" \
    alpine sh -c 'rm -rf /data/* /data/.* 2>/dev/null; tar xzf /backup/data.tar.gz -C /data'
  # Re-fetch the recorded source version so code matches the restored data.
  if [[ -n "$ver" ]]; then
    DOCKER_GUI_VERSION="$ver" DOCKER_GUI_DIR="$INSTALL_DIR" bash "$INSTALL_DIR/source/scripts/install.sh" || true
  fi
  cd "$INSTALL_DIR" && $COMPOSE up -d
  echo "==> Rollback complete."
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
  rollback)          shift; cmd_rollback "$@" ;;
  doctor)            shift; cmd_doctor "$@" ;;
  uninstall)         shift; cmd_uninstall "$@" ;;
  version|--version) shift; cmd_version "$@" ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Run 'docker-gui --help' for usage." >&2
    exit 1
    ;;
esac
