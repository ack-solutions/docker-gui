#!/usr/bin/env bash
#
# Spin up the full docker-gui stack locally (api + web) from this repo, create
# the first admin, and print the URL. Mirrors a real server install but without
# touching /opt or /usr/local. See docker-compose.local.yml.
#
#   bash scripts/run-local.sh          # build + start + bootstrap
#   bash scripts/run-local.sh --down   # stop + remove (keeps data)
#   bash scripts/run-local.sh --purge  # stop + remove + wipe data

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.local.yml"
WEB_URL="http://localhost:3000"
SETUP_SECRET="localtry-setup-secret-0123456789abcdef"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin12345}"
ADMIN_NAME="${ADMIN_NAME:-Local Admin}"

case "${1:-}" in
  --down)  $COMPOSE down; exit 0 ;;
  --purge) $COMPOSE down -v; exit 0 ;;
esac

echo "==> Building images (first run takes a few minutes)…"
$COMPOSE build

echo "==> Starting stack…"
$COMPOSE up -d

echo "==> Waiting for the API to be healthy…"
for i in $(seq 1 60); do
  if curl -fsS "$WEB_URL/api/v1/health/live" >/dev/null 2>&1; then
    echo "    API is up."
    break
  fi
  [[ $i -eq 60 ]] && { echo "API did not come up in time. Check: $COMPOSE logs api"; exit 1; }
  sleep 2
done

echo "==> Creating the first admin (if not already created)…"
code=$(curl -s -o /tmp/dgui-bootstrap.json -w '%{http_code}' \
  -X POST "$WEB_URL/api/v1/setup/bootstrap" \
  -H "x-setup-secret: $SETUP_SECRET" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"name\":\"$ADMIN_NAME\"}" || true)

if [[ "$code" == "201" ]]; then
  echo "    Admin created."
elif [[ "$code" == "409" ]]; then
  echo "    Admin already exists (reusing it)."
else
  echo "    Bootstrap returned HTTP $code: $(cat /tmp/dgui-bootstrap.json 2>/dev/null)"
fi

cat <<EOF

──────────────────────────────────────────────
  docker-gui is running locally 🎉

  Open:      $WEB_URL
  Email:     $ADMIN_EMAIL
  Password:  $ADMIN_PASSWORD

  Logs:      docker compose -f docker-compose.local.yml logs -f
  Stop:      bash scripts/run-local.sh --down
  Wipe:      bash scripts/run-local.sh --purge
──────────────────────────────────────────────
EOF
