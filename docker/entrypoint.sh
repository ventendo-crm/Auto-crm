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

echo "[auto-crm] Applying multitenancy backfill (companies)..."
if [ -f ./prisma/ensure-companies-multitenancy.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-companies-multitenancy.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Companies ensure failed — check logs; continuing"
fi

echo "[auto-crm] Ensuring telegram invite link columns..."
if [ -f ./prisma/ensure-telegram-link-token.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-telegram-link-token.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Telegram link token ensure failed — continuing"
fi

echo "[auto-crm] Ensuring company calculator settings table..."
if [ -f ./prisma/ensure-company-calculator-settings.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-company-calculator-settings.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Company calculator settings ensure failed — continuing"
fi

echo "[auto-crm] Applying database schema..."
if command -v npx >/dev/null 2>&1; then
  # Non-interactive: do not hang/fail the whole container on drift prompts.
  # Ensure SQL above already applies critical columns safely.
  set +e
  run_as_nextjs npx prisma db push --skip-generate --accept-data-loss
  push_status=$?
  set -e
  if [ "$push_status" -ne 0 ]; then
    echo "[auto-crm] WARNING: prisma db push exited with $push_status — starting app anyway"
  else
    echo "[auto-crm] Database schema is up to date"
  fi
fi

echo "[auto-crm] Ensuring default roles..."
if [ -f ./prisma/ensure-roles.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-roles.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Role ensure skipped or failed"
fi

echo "[auto-crm] Ensuring contract document slots..."
if [ -f ./prisma/ensure-contract-document.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-contract-document.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Contract document ensure skipped or failed"
fi

echo "[auto-crm] Ensuring search agreement document slots..."
if [ -f ./prisma/ensure-search-agreement-document.sql ]; then
  run_as_nextjs npx prisma db execute --file ./prisma/ensure-search-agreement-document.sql --schema ./prisma/schema.prisma \
    || echo "[auto-crm] Search agreement document ensure skipped or failed"
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
