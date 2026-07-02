-- CreateTable
CREATE TABLE "email_templates" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlTitle" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("key")
);

-- Seed default templates
INSERT INTO "email_templates" ("key", "name", "subject", "textBody", "htmlTitle", "description", "updatedAt")
VALUES
  (
    'CLIENT_STAGE',
    'Смена этапа сделки',
    'ImportCRM: этап «{{stageLabel}}»',
    'Обновление по вашей сделке

Этап: {{stageLabel}}

{{body}}
{{carLine}}
{{vinLine}}

Подробности — в личном кабинете:
{{portalUrl}}',
    'Обновление по вашей сделке',
    'Письмо клиенту при смене этапа сделки. Переменные: {{stageLabel}}, {{body}}, {{carLine}}, {{vinLine}}, {{portalUrl}}',
    CURRENT_TIMESTAMP
  ),
  (
    'CLIENT_COMMENT',
    'Комментарий менеджера',
    'ImportCRM: новый комментарий по вашей сделке',
    'Менеджер оставил комментарий по вашей сделке

Клиент: {{clientName}}
VIN: {{vin}}
Автор: {{authorName}} ({{authorRole}})

{{commentText}}

Личный кабинет: {{portalUrl}}',
    'Новый комментарий',
    'Письмо клиенту при комментарии сотрудника. Переменные: {{clientName}}, {{vin}}, {{authorName}}, {{authorRole}}, {{commentText}}, {{portalUrl}}',
    CURRENT_TIMESTAMP
  ),
  (
    'CLIENT_TEST',
    'Тестовое письмо',
    'ImportCRM: тестовое уведомление',
    'Тестовое email-уведомление

Аккаунт: {{userName}}
Если вы видите это письмо, почта настроена правильно.',
    'Тестовое уведомление',
    'Тестовое письмо из профиля клиента. Переменные: {{userName}}',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;
