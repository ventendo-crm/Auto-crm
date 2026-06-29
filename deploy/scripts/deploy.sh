#!/bin/bash
# Сборка и запуск приложения.
# Запуск из корня проекта: bash deploy/scripts/deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="deploy/.env"
COMPOSE_FILE="deploy/docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Файл $ENV_FILE не найден."
  echo "Скопируйте шаблон: cp deploy/.env.example deploy/.env"
  exit 1
fi

echo "==> Версия кода: $(git log -1 --oneline)"

BUILD_ARGS=()
if [ "${FORCE_REBUILD:-}" = "1" ]; then
  echo "==> Принудительная пересборка (FORCE_REBUILD=1)..."
  BUILD_ARGS+=(--no-cache)
fi

echo "==> Сборка и запуск контейнеров..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build "${BUILD_ARGS[@]}" app
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate app

echo ""
echo "==> Статус:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

if docker exec auto-crm-app sh -c 'grep -rq skipSaveRef /app/.next 2>/dev/null'; then
  echo ""
  echo "OK: образ содержит актуальный фронтенд (deal-expenses)."
else
  echo ""
  echo "ВНИМАНИЕ: в образе не найден код расходов. Запустите: FORCE_REBUILD=1 bash deploy/scripts/deploy.sh"
fi

echo ""
echo "Логи приложения: docker logs -f auto-crm-app"
echo "После первого запуска с RUN_SEED=true смените пароль admin и установите RUN_SEED=false"
