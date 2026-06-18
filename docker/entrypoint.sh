#!/bin/sh
set -e

echo "[auto-crm] Applying database schema..."
if command -v npx >/dev/null 2>&1; then
  npx prisma db push --skip-generate
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[auto-crm] Seeding database..."
  npx prisma db seed || echo "[auto-crm] Seed skipped or failed"
fi

echo "[auto-crm] Starting application on port ${PORT:-3000}..."
exec node server.js
