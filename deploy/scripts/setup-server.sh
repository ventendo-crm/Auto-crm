#!/bin/bash
# Первичная настройка Ubuntu 24.04 на Timeweb VPS.
# Запуск: sudo bash deploy/scripts/setup-server.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт от root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Обновление пакетов..."
apt-get update -y
apt-get upgrade -y

echo "==> Установка Docker..."
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Установка Nginx и Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Настройка firewall (ufw)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo "==> Каталог приложения..."
mkdir -p /opt/auto-crm

echo ""
echo "Готово. Дальше:"
echo "  1. Загрузите проект в /opt/auto-crm (git clone или scp)"
echo "  2. cp deploy/.env.example deploy/.env && nano deploy/.env"
echo "  3. bash deploy/scripts/deploy.sh"
echo "  4. Скопируйте nginx-конфиги из deploy/nginx/ в /etc/nginx/sites-available/"
echo "  5. certbot --nginx -d importcrm.ru -d www.importcrm.ru -d storage.importcrm.ru"
