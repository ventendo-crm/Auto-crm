#!/bin/sh
set -e

echo "[auto-crm] Applying database schema..."
if command -v npx >/dev/null 2>&1; then
  npx prisma db push --skip-generate
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[auto-crm] Seeding database..."
  if [ -f ./node_modules/.bin/tsx ]; then
    ./node_modules/.bin/tsx prisma/seed.ts || echo "[auto-crm] Seed skipped or failed"
  else
    npx tsx prisma/seed.ts || echo "[auto-crm] Seed skipped or failed"
  fi
fi

echo "[auto-crm] Starting application on port ${PORT:-3000}..."
exec node server.js
