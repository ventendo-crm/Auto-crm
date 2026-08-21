#!/usr/bin/env bash
# Проверка: открывается ли che168 с сервера CRM через TELEGRAM_PROXY_URL.
# Запуск на VPS:
#   cd /opt/auto-crm   # или /opt/Auto-crm
#   bash deploy/scripts/check-che168-proxy.sh
#
# Скрипт НЕ печатает логин/пароль прокси.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/deploy/.env"
URL="${1:-https://www.che168.com/dealer/619744/58307449.html}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: не найден $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# Берём только нужную строку, без source всего .env (там могут быть спецсимволы)
PROXY_LINE="$(grep -E '^TELEGRAM_PROXY_URL=' "$ENV_FILE" | tail -n1 || true)"
set +a

PROXY_URL="${PROXY_LINE#TELEGRAM_PROXY_URL=}"
PROXY_URL="${PROXY_URL%\"}"
PROXY_URL="${PROXY_URL#\"}"
PROXY_URL="${PROXY_URL%\'}"
PROXY_URL="${PROXY_URL#\'}"

echo "== Che168 proxy check =="
echo "URL: $URL"
if [[ -n "${PROXY_URL}" ]]; then
  echo "TELEGRAM_PROXY_URL: задан (длина ${#PROXY_URL})"
else
  echo "TELEGRAM_PROXY_URL: пусто"
fi
echo

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

classify() {
  local file="$1"
  local size
  size="$(wc -c < "$file" | tr -d ' ')"
  echo "  size: ${size} bytes"
  if grep -qiE 'EO_Bot|__tst_status|TencentEdgeOne|captcha|challenge' "$file"; then
    echo "  content: ANTIBOT / challenge page"
    return 2
  fi
  if grep -qiE 'og:image|万元|排量|车源|infophoto|autohome' "$file"; then
    echo "  content: looks like LISTING HTML"
    return 0
  fi
  if [[ "$size" -lt 2000 ]]; then
    echo "  content: too small / unknown stub"
    return 2
  fi
  echo "  content: HTML present, markers unclear — open file manually"
  return 1
}

run_fetch() {
  local label="$1"
  shift
  local out="$TMP_DIR/${label}.html"
  local code
  echo "-- $label --"
  set +e
  code="$(
    curl -sL --max-time 30 -A "$UA" -o "$out" -w '%{http_code}' "$@" "$URL"
  )"
  local rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "  curl exit: $rc (timeout/network)"
    return 1
  fi
  echo "  HTTP: $code"
  classify "$out"
}

echo "1) Без прокси"
run_fetch "direct" || true
echo

if [[ -z "${PROXY_URL}" ]]; then
  echo "Прокси не задан — проверка через TELEGRAM_PROXY_URL невозможна."
  exit 2
fi

echo "2) Через TELEGRAM_PROXY_URL"
run_fetch "proxy" -x "$PROXY_URL" || true
echo

# Итог по файлам
DIRECT_SIZE="$(wc -c < "$TMP_DIR/direct.html" 2>/dev/null | tr -d ' ' || echo 0)"
PROXY_SIZE="$(wc -c < "$TMP_DIR/proxy.html" 2>/dev/null | tr -d ' ' || echo 0)"

echo "== Вердикт =="
if [[ -f "$TMP_DIR/proxy.html" ]] && grep -qiE 'og:image|万元|排量|车源|infophoto|autohome' "$TMP_DIR/proxy.html"; then
  echo "OK: через текущий прокси похоже на реальное объявление. Можно делать MVP-парсер."
  exit 0
fi

if [[ -f "$TMP_DIR/proxy.html" ]] && grep -qiE 'EO_Bot|__tst_status' "$TMP_DIR/proxy.html"; then
  echo "PARTIAL: прокси до сайта достучался, но стоит антибот EdgeOne."
  echo "Одного HTTP-прокси мало — нужен headless/browser, обход challenge или платный API."
  exit 3
fi

if [[ "${PROXY_SIZE}" -eq 0 ]]; then
  echo "FAIL: через прокси страница не скачалась (сеть/прокси)."
  exit 4
fi

echo "UNKNOWN: прокси ответил (${PROXY_SIZE} байт), но разметку объявления не распознали."
echo "Посмотрите: head -c 800 $TMP_DIR/proxy.html  (файл удалится при выходе — скопируйте до этого)"
exit 5
