#!/bin/sh
set -e

echo "[auto-crm] Applying database schema..."
if [ -f ./node_modules/.bin/prisma ]; then
  ./node_modules/.bin/prisma db push --skip-generate
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[auto-crm] Seeding database..."
  ./node_modules/.bin/prisma db seed || echo "[auto-crm] Seed skipped or failed"
fi

echo "[auto-crm] Starting application on port ${PORT:-3000}..."
exec node server.js
