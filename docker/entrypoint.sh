#!/bin/sh
set -e

UPLOADS_DIR="/app/uploads"

echo "[auto-crm] Preparing uploads directory..."
mkdir -p "$UPLOADS_DIR"
chown -R nextjs:nodejs "$UPLOADS_DIR"
chmod 775 "$UPLOADS_DIR"

run_as_nextjs() {
  su-exec nextjs "$@"
}

echo "[auto-crm] Applying database schema..."
if command -v npx >/dev/null 2>&1; then
  run_as_nextjs npx prisma db push --skip-generate
fi

echo "[auto-crm] Ensuring default roles..."
if [ -f ./prisma/ensure-roles.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-roles.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Role ensure skipped or failed"
fi

echo "[auto-crm] Backfilling manager links..."
if [ -f ./scripts/backfill-manager-links.mjs ]; then
  run_as_nextjs node ./scripts/backfill-manager-links.mjs \
    || echo "[auto-crm] Manager links backfill skipped or failed"
elif [ -f ./prisma/backfill-manager-links.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/backfill-manager-links.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Manager links backfill skipped or failed"
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[auto-crm] Seeding database..."
  if [ -f ./node_modules/.bin/tsx ]; then
    run_as_nextjs ./node_modules/.bin/tsx prisma/seed.ts || echo "[auto-crm] Seed skipped or failed"
  else
    run_as_nextjs npx tsx prisma/seed.ts || echo "[auto-crm] Seed skipped or failed"
  fi
fi

echo "[auto-crm] Starting application on port ${PORT:-3000}..."
exec su-exec nextjs node server.js
