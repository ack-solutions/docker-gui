#!/usr/bin/env bash
set -euo pipefail

checksum_file="node_modules/.yarn-install-checksum"
tmp_checksum_file="$(mktemp)"

if [ ! -f package.json ]; then
  echo "package.json not found; aborting." >&2
  exit 1
fi

if [ ! -f yarn.lock ]; then
  echo "yarn.lock not found; aborting." >&2
  exit 1
fi

cat package.json yarn.lock | sha256sum | awk '{print $1}' > "${tmp_checksum_file}"
current_checksum="$(cat "${tmp_checksum_file}")"
rm -f "${tmp_checksum_file}"

needs_install=false

if [ ! -d node_modules ]; then
  needs_install=true
elif [ ! -f "${checksum_file}" ]; then
  needs_install=true
else
  stored_checksum="$(cat "${checksum_file}")"
  if [ "${stored_checksum}" != "${current_checksum}" ]; then
    needs_install=true
  fi
fi

if [ "${needs_install}" = true ]; then
  echo "==> Installing dependencies (yarn install --frozen-lockfile)"
  yarn install --frozen-lockfile
  printf "%s" "${current_checksum}" > "${checksum_file}"
else
  echo "==> Dependencies are up to date"
fi

if [ "${1:-}" = "--" ]; then
  shift
fi

exec "$@"
