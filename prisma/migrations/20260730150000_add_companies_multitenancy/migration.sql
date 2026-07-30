-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "telegramBotToken" TEXT,
    "telegramBotId" TEXT,
    "telegramBotUsername" TEXT,
    "telegramBotName" TEXT,
    "telegramDefaultChatId" TEXT,
    "telegramWebhookSecret" TEXT,
    "telegramConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- Default company for existing data
INSERT INTO "companies" ("id", "name", "slug", "updatedAt")
VALUES ('default_company_seed', 'Default', 'default', CURRENT_TIMESTAMP);

-- User: add companyId + isPlatformAdmin
ALTER TABLE "users" ADD COLUMN "companyId" TEXT;
ALTER TABLE "users" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "companyId" = 'default_company_seed' WHERE "companyId" IS NULL;
UPDATE "users" SET "isPlatformAdmin" = true WHERE "email" = 'admin@auto-crm.local';

ALTER TABLE "users" ALTER COLUMN "companyId" SET NOT NULL;
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_companyId_email_key" ON "users"("companyId", "email");
CREATE INDEX "users_companyId_idx" ON "users"("companyId");
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deal: add companyId
ALTER TABLE "deals" ADD COLUMN "companyId" TEXT;
UPDATE "deals" SET "companyId" = 'default_company_seed' WHERE "companyId" IS NULL;
ALTER TABLE "deals" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX "deals_companyId_idx" ON "deals"("companyId");
ALTER TABLE "deals" ADD CONSTRAINT "deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ManagerLink
ALTER TABLE "manager_links" ADD COLUMN "companyId" TEXT;
UPDATE "manager_links" SET "companyId" = 'default_company_seed' WHERE "companyId" IS NULL;
ALTER TABLE "manager_links" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX "manager_links_companyId_idx" ON "manager_links"("companyId");
ALTER TABLE "manager_links" ADD CONSTRAINT "manager_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog
ALTER TABLE "audit_logs" ADD COLUMN "companyId" TEXT;
UPDATE "audit_logs" SET "companyId" = 'default_company_seed' WHERE "companyId" IS NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailTemplate: rebuild with id + companyId
CREATE TABLE "email_templates_new" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlTitle" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "email_templates_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "email_templates_new" ("id", "companyId", "key", "name", "subject", "textBody", "htmlTitle", "description", "updatedAt", "updatedById")
SELECT
  md5(random()::text || clock_timestamp()::text || "key"),
  'default_company_seed',
  "key", "name", "subject", "textBody", "htmlTitle", "description", "updatedAt", "updatedById"
FROM "email_templates";

DROP TABLE "email_templates";
ALTER TABLE "email_templates_new" RENAME TO "email_templates";
CREATE UNIQUE INDEX "email_templates_companyId_key_key" ON "email_templates"("companyId", "key");
CREATE INDEX "email_templates_companyId_idx" ON "email_templates"("companyId");
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TelegramTemplate: rebuild
CREATE TABLE "telegram_templates_new" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "telegram_templates_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "telegram_templates_new" ("id", "companyId", "key", "name", "textBody", "description", "updatedAt", "updatedById")
SELECT
  md5(random()::text || clock_timestamp()::text || "key"),
  'default_company_seed',
  "key", "name", "textBody", "description", "updatedAt", "updatedById"
FROM "telegram_templates";

DROP TABLE "telegram_templates";
ALTER TABLE "telegram_templates_new" RENAME TO "telegram_templates";
CREATE UNIQUE INDEX "telegram_templates_companyId_key_key" ON "telegram_templates"("companyId", "key");
CREATE INDEX "telegram_templates_companyId_idx" ON "telegram_templates"("companyId");
ALTER TABLE "telegram_templates" ADD CONSTRAINT "telegram_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClientStageMessage: rebuild
CREATE TABLE "client_stage_messages_new" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stage" "DealStageType" NOT NULL,
    "textBody" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "client_stage_messages_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "client_stage_messages_new" ("id", "companyId", "stage", "textBody", "updatedAt", "updatedById")
SELECT
  md5(random()::text || clock_timestamp()::text || "stage"::text),
  'default_company_seed',
  "stage", "textBody", "updatedAt", "updatedById"
FROM "client_stage_messages";

DROP TABLE "client_stage_messages";
ALTER TABLE "client_stage_messages_new" RENAME TO "client_stage_messages";
CREATE UNIQUE INDEX "client_stage_messages_companyId_stage_key" ON "client_stage_messages"("companyId", "stage");
CREATE INDEX "client_stage_messages_companyId_idx" ON "client_stage_messages"("companyId");
ALTER TABLE "client_stage_messages" ADD CONSTRAINT "client_stage_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
