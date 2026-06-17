#!/bin/bash
# Установка nginx-конфигов и перезагрузка.
# Запуск: sudo bash deploy/scripts/install-nginx.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

for site in importcrm.ru storage.importcrm.ru; do
  src="$ROOT_DIR/deploy/nginx/${site}.conf"
  dst="/etc/nginx/sites-available/${site}.conf"
  if [ ! -f "$src" ]; then
    echo "Не найден $src"
    exit 1
  fi
  cp "$src" "$dst"
  ln -sf "$dst" "/etc/nginx/sites-enabled/${site}.conf"
  echo "Установлен: $dst"
done

# Отключаем дефолтный сайт, если мешает
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo ""
echo "Nginx перезагружен. Для SSL:"
echo "  certbot --nginx -d importcrm.ru -d www.importcrm.ru -d storage.importcrm.ru"
