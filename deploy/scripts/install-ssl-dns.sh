#!/bin/bash
# SSL через DNS (обходит блокировку HTTP-проверки Let's Encrypt на Timeweb).
# Запуск: bash deploy/scripts/install-ssl-dns.sh your@email.com

set -euo pipefail

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "Использование: bash deploy/scripts/install-ssl-dns.sh your@email.com"
  exit 1
fi

DOMAINS=(importcrm.ru www.importcrm.ru storage.importcrm.ru)

echo "==> SSL через DNS для: ${DOMAINS[*]}"
echo ""
echo "Certbot покажет TXT-записи. Добавьте их в REG.RU:"
echo "  Тип: TXT"
echo "  Имя: как покажет certbot (_acme-challenge или _acme-challenge.www и т.д.)"
echo "  Значение: строка из certbot"
echo ""
echo "Проверка TXT (подставьте имя):"
echo "  dig +short TXT _acme-challenge.importcrm.ru @ns1.hosting.reg.ru"
echo ""
read -r -p "Нажмите Enter, когда будете готовы..."

certbot certonly \
  --manual \
  --preferred-challenges dns \
  --agree-tos \
  --no-eff-email \
  -m "$EMAIL" \
  -d importcrm.ru \
  -d www.importcrm.ru \
  -d storage.importcrm.ru

echo ""
echo "==> Установка сертификата в Nginx..."
certbot install --nginx --cert-name importcrm.ru

echo ""
echo "==> Проверка..."
nginx -t
systemctl reload nginx

echo ""
echo "Готово. Откройте: https://importcrm.ru"
