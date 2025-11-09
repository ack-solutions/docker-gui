#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v yarn >/dev/null 2>&1; then
  echo "Error: yarn is required but was not found in PATH." >&2
  exit 1
fi

echo "📦 Installing dependencies (if needed)..."
yarn install --frozen-lockfile

echo "🔧 Generating Prisma client..."
yarn prisma:generate

# echo "🧱 Running database migrations..."
# yarn db:migrate || echo "No Migrations to run" 

echo "🌱 Seeding default data..."
yarn db:seed || echo "No Seed data to run"

echo ""
read -rp "Admin email [admin@example.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}

read -rp "Admin name  [Super Administrator]: " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Super Administrator}

while true; do
  read -rsp "Admin password: " ADMIN_PASSWORD
  echo
  read -rsp "Confirm password: " ADMIN_PASSWORD_CONFIRM
  echo

  if [[ -z "$ADMIN_PASSWORD" ]]; then
    echo "Password cannot be empty. Try again."
    continue
  fi

  if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
    echo "Passwords do not match. Try again."
    continue
  fi

  break
done

echo ""
echo "👤 Creating administrator account..."
yarn tsx scripts/create-admin.ts "$ADMIN_EMAIL" "$ADMIN_NAME" "$ADMIN_PASSWORD"

echo "✅ Setup complete! You can now start the application with 'yarn dev' or your preferred process manager."
