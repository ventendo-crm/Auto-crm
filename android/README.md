# Import CRM — Android WebView

Нативная оболочка для [https://importcrm.ru](https://importcrm.ru) с кешированием, сохранением сессии и push-уведомлениями (Firebase).

## Возможности

- WebView на весь экран, pull-to-refresh
- Кеш страниц и `localStorage` / cookies (сессия сохраняется после перезапуска)
- Офлайн: при отсутствии сети пробует показать кеш
- Загрузка файлов из WebView (документы сделок)
- Push через Firebase Cloud Messaging
- Deep link из уведомления в нужный раздел сайта

## 1. Firebase

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Создайте проект (или используйте существующий)
3. **Add app → Android**, package name: `ru.importcrm.app`
4. Скачайте `google-services.json` → положите в `android/app/google-services.json`
5. **Project settings → Service accounts → Generate new private key**
6. JSON сервисного аккаунта добавьте на сервер в `deploy/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

(одна строка, без переносов)

Перезапустите app-контейнер:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --force-recreate app
```

## 2. Сборка APK

Требуется **Android Studio** (или JDK 17 + Android SDK).

```bash
cd android
# Скопируйте конфиг Firebase:
cp app/google-services.json.example app/google-services.json
# Замените app/google-services.json на файл из Firebase Console
```

Откройте папку `android/` в Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Или из терминала (после `gradle wrapper` в Android Studio):

```bash
./gradlew assembleRelease
```

APK: `app/build/outputs/apk/release/app-release-unsigned.apk`

Для публикации подпишите keystore (Android Studio → Generate Signed Bundle / APK).

## 3. Как работают уведомления

1. Пользователь входит в приложение (cookie `auth-token`)
2. Приложение получает FCM-токен и отправляет его на `POST /api/push/fcm/subscribe`
3. При новых событиях CRM сервер шлёт push через Firebase
4. Тап по уведомлению открывает нужную страницу на importcrm.ru

## 4. Проверка

1. Установите APK на телефон
2. Войдите в аккаунт
3. Разрешите уведомления
4. С другого устройства создайте событие (комментарий, смена этапа) — push должен прийти в течение нескольких секунд

## Структура

| Файл | Назначение |
|------|------------|
| `MainActivity.kt` | WebView, кеш, файлы, offline |
| `PushRegistrar.kt` | Регистрация FCM-токена на сервере |
| `ImportCrmMessagingService.kt` | Приём и показ уведомлений |

## Примечания

- Web Push в браузере и FCM в приложении работают параллельно
- Без `FIREBASE_SERVICE_ACCOUNT_JSON` на сервере приложение откроется, но push не придут
- `google-services.json` в git не коммитится — только локально и в CI
