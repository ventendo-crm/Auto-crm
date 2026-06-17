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

echo "==> Сборка и запуск контейнеров..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo ""
echo "==> Статус:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo ""
echo "Логи приложения: docker logs -f auto-crm-app"
echo "После первого запуска с RUN_SEED=true смените пароль admin и установите RUN_SEED=false"
