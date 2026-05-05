#!/usr/bin/env bash
#
# docker-gui uninstaller.
#
# Usage:
#   sudo docker-gui uninstall                # interactive
#   sudo docker-gui uninstall --keep-data    # remove containers + images, preserve volumes/.env
#   sudo docker-gui uninstall --purge        # remove everything (containers, volumes, install dir)
#   sudo docker-gui uninstall --yes --purge  # non-interactive purge

set -euo pipefail

INSTALL_DIR="${DOCKER_GUI_DIR:-/opt/docker-gui}"

KEEP_DATA=0
PURGE=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --keep-data) KEEP_DATA=1 ;;
    --purge)     PURGE=1 ;;
    --yes|-y)    ASSUME_YES=1 ;;
    --help|-h)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root (sudo)." >&2
  exit 1
fi

if [[ ! -d "$INSTALL_DIR" ]]; then
  echo "No install at $INSTALL_DIR. Nothing to do."
  exit 0
fi

cd "$INSTALL_DIR"

if [[ $KEEP_DATA -eq 0 && $PURGE -eq 0 ]]; then
  echo "Uninstall mode not specified. Choose one:"
  echo "  --keep-data   Stop and remove containers + images. Keep volumes + .env + config.yml."
  echo "  --purge       Remove everything including all data and the install directory."
  exit 1
fi

if [[ $ASSUME_YES -eq 0 ]]; then
  if [[ $PURGE -eq 1 ]]; then
    echo "WARNING: this will permanently delete:"
    echo "  - All docker-gui containers and images"
    echo "  - All docker-gui volumes (database, configs, Caddy state + certs)"
    echo "  - $INSTALL_DIR (config + secrets + source)"
    echo "  - The /usr/local/bin/docker-gui CLI"
  else
    echo "This will stop docker-gui and remove its containers and images."
    echo "Volumes (database, Caddy state) and $INSTALL_DIR/.env / config.yml will be preserved."
  fi
  read -r -p "Continue? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

echo "==> Stopping containers"
if [[ $PURGE -eq 1 ]]; then
  docker compose down -v --rmi local --remove-orphans || true
else
  docker compose down --rmi local --remove-orphans || true
fi

if [[ $PURGE -eq 1 ]]; then
  echo "==> Removing CLI"
  rm -f /usr/local/bin/docker-gui

  echo "==> Removing install directory"
  cd /
  rm -rf "$INSTALL_DIR"
fi

echo "==> Done."
