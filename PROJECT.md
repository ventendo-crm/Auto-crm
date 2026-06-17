# Архитектура проекта

```

```

```
auto-crm/
│
├── apps/
│   └── web/                     # Next.js приложение
│
├── packages/
│   ├── ui/                      # Общие UI-компоненты
│   ├── shared/                  # Типы, константы
│   └── notifications/           # Email, Telegram, Push
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docker/
│   ├── postgres/
│   ├── redis/
│   └── minio/
│
├── docs/
│   ├── api.md
│   ├── architecture.md
│   └── deployment.md
│
├── .env
├── docker-compose.yml
└── README.md
```

---

# Основные сущности БД

## Пользователи

```

```

```
model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String

  roleId        String
  role          Role     @relation(fields: [roleId], references: [id])

  telegramChatId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  deals      Deal[]
  comments   Comment[]
  logs       AuditLog[]
}
```

## Роли

```

```

```
model Role {
  id    String @id @default(cuid())

  name  String @unique

  users User[]
}
```

Роли:

```

```

```
ADMIN
MANAGER
VIEWER
```

---

# Этапы сделки

```

```

```
enum DealStageType {
  SEARCH
  INVOICE
  PREPARATION
  CUSTOMS
  TRANSPORT
  DELIVERY
}
```

---

# Сделка

Главная сущность CRM.

```

```

```
model Deal {

  id String @id @default(cuid())

  clientName String

  phone String?

  email String?

  vin String

  carBrand String?

  carModel String?

  carYear Int?

  purchasePrice Decimal?

  prepayment Decimal?

  balance Decimal?

  destinationCity String

  destinationCountry String

  managerId String
  manager User @relation(fields: [managerId], references: [id])

  currentStage DealStageType

  stageEnteredAt DateTime

  expectedArrival DateTime?

  actualArrival DateTime?

  priority Int @default(1)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks Task[]

  documents Document[]

  comments Comment[]

  stageHistory StageHistory[]

  notifications Notification[]

  media MediaFile[]

  shipment Shipment?

}
```

---

# История этапов

```

```

```
model StageHistory {

  id String @id @default(cuid())

  dealId String

  deal Deal @relation(fields: [dealId], references: [id])

  fromStage DealStageType

  toStage DealStageType

  changedById String

  changedBy User @relation(fields: [changedById], references: [id])

  createdAt DateTime @default(now())
}
```

---

# Подзадачи внутри сделки

То, что вы называли дополнительными карточками.

```

```

```
model Task {

  id String @id @default(cuid())

  title String

  description String?

  link String?

  dealId String

  deal Deal @relation(fields: [dealId], references: [id])

  createdById String

  createdAt DateTime @default(now())

  media MediaFile[]
}
```

---

# Фото и видео

Объединяем в одну таблицу.

```

```

```
enum MediaType {
  PHOTO
  VIDEO
}
```

```

```

```
model MediaFile {

  id String @id @default(cuid())

  type MediaType

  fileName String

  fileUrl String

  thumbnailUrl String?

  size Int

  taskId String?

  task Task? @relation(fields: [taskId], references: [id])

  dealId String?

  deal Deal? @relation(fields: [dealId], references: [id])

  uploadedById String

  uploadedAt DateTime @default(now())
}
```

---

# Документы

```

```

```
enum DocumentType {
  PASSPORT
  INN
  SNILS
  PAYMENT
}
```

```

```

```
enum DocumentStatus {
  MISSING
  RECEIVED
  VERIFIED
}
```

```

```

```
model Document {

  id String @id @default(cuid())

  dealId String

  deal Deal @relation(fields: [dealId], references: [id])

  type DocumentType

  status DocumentStatus

  fileUrl String?

  uploadedById String?

  uploadedAt DateTime?

}
```

---

# Комментарии

```

```

```
model Comment {

  id String @id @default(cuid())

  text String

  dealId String

  deal Deal @relation(fields: [dealId], references: [id])

  authorId String

  author User @relation(fields: [authorId], references: [id])

  createdAt DateTime @default(now())
}
```

---

# Логистика

```

```

```
model Shipment {

  id String @id @default(cuid())

  dealId String @unique

  deal Deal @relation(fields: [dealId], references: [id])

  purchaseDate DateTime?

  shippingDate DateTime?

  expectedArrival DateTime?

  actualArrival DateTime?

  customsCompleted DateTime?
}
```

---

# Напоминания

```

```

```
model Reminder {

  id String @id @default(cuid())

  dealId String

  deal Deal @relation(fields: [dealId], references: [id])

  title String

  dueDate DateTime

  completed Boolean @default(false)

  createdAt DateTime @default(now())
}
```

---

# Уведомления

```

```

```
enum NotificationType {
  SYSTEM
  EMAIL
  TELEGRAM
  PUSH
}
```

```

```

```
model Notification {

  id String @id @default(cuid())

  dealId String?

  deal Deal? @relation(fields: [dealId], references: [id])

  userId String

  title String

  message String

  type NotificationType

  read Boolean @default(false)

  createdAt DateTime @default(now())
}
```

---

# Audit Log

Полная история изменений.

```

```

```
model AuditLog {

  id String @id @default(cuid())

  userId String

  user User @relation(fields: [userId], references: [id])

  entity String

  entityId String

  action String

  oldValue Json?

  newValue Json?

  createdAt DateTime @default(now())
}
```

---

# Kanban-логика

Колонки:

```

```

```
Поиск авто
    ↓
Инвойс
    ↓
Подготовка
    ↓
Таможня
    ↓
Транспортировка
    ↓
Получение
```

При перетаскивании карточки:

1. Обновляется `currentStage`
2. Обновляется `stageEnteredAt`
3. Создается `StageHistory`
4. Создается `AuditLog`
5. Создается `Notification`

Отправляется TelegramDashboard

Карточки статистики:

```

```

```
Всего сделок

Сделок в работе

Завершено

Просрочено

Сумма предоплат

Ожидают прибытия
```

Графики:

```

```

```
Сделки по этапам

Просрочки

Поступления по месяцам

ETA поставок
```

---

# Telegram Bot

Команды:

```

```

```
/start

/mydeals

/overdue

/today

/help
```

Уведомления:

```

```

```
🚗 Сделка переведена

Клиент:
Иван Петров

VIN:
WAUZZZ123456

Этап:

Таможня →
Транспортировка

Менеджер:
Александр

Дата:
09.06.2026 12:40
```

---



