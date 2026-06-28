#!/bin/bash
# Починка DNS и Docker на Timeweb VPS, если сборка падает с:
#   lookup dockerhub.timeweb.cloud ... i/o timeout
#
# Запуск: sudo bash deploy/scripts/fix-server-network.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

echo "==> DNS: Google + Cloudflare"
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/dns.conf << 'EOF'
[Resolve]
DNS=8.8.8.8 1.1.1.1
FallbackDNS=9.9.9.9
EOF

systemctl restart systemd-resolved 2>/dev/null || true

cat > /etc/resolv.conf << 'EOF'
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF

echo "==> Проверка DNS..."
if ! getent hosts registry-1.docker.io >/dev/null 2>&1; then
  echo "WARN: registry-1.docker.io не резолвится"
else
  echo "OK: registry-1.docker.io"
fi

if [ -f /etc/docker/daemon.json ]; then
  echo "==> Текущий /etc/docker/daemon.json:"
  cat /etc/docker/daemon.json
  echo ""
  echo "Если сборка всё ещё падает на dockerhub.timeweb.cloud — временно отключите mirror:"
  echo "  cp /etc/docker/daemon.json /etc/docker/daemon.json.bak"
  echo '  echo "{}" > /etc/docker/daemon.json && systemctl restart docker'
fi

echo ""
echo "==> Перезапуск Docker..."
systemctl restart docker
sleep 2

echo ""
echo "Готово. Дальше из /opt/Auto-crm:"
echo "  git pull origin main"
echo "  bash deploy/scripts/deploy.sh"
