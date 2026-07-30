-- Idempotent multitenancy backfill for existing DBs (used by docker entrypoint before db push).
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
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
  END IF;
END $$;

INSERT INTO "companies" ("id", "name", "slug", "updatedAt")
SELECT 'default_company_seed', 'Default', 'default', CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "companies" WHERE "id" = 'default_company_seed' OR "slug" = 'default'
);

-- Prefer existing default company id if slug already exists with another id
DO $$
DECLARE
  default_id TEXT;
BEGIN
  SELECT "id" INTO default_id FROM "companies" WHERE "slug" = 'default' LIMIT 1;
  IF default_id IS NULL THEN
    SELECT "id" INTO default_id FROM "companies" WHERE "id" = 'default_company_seed' LIMIT 1;
  END IF;
  IF default_id IS NULL THEN
    INSERT INTO "companies" ("id", "name", "slug", "updatedAt")
    VALUES ('default_company_seed', 'Default', 'default', CURRENT_TIMESTAMP);
    default_id := 'default_company_seed';
  END IF;

  -- users.companyId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'companyId'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "companyId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'isPlatformAdmin'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  UPDATE "users" SET "companyId" = default_id WHERE "companyId" IS NULL;
  UPDATE "users" SET "isPlatformAdmin" = true WHERE "email" = 'admin@auto-crm.local';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'companyId'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "companyId" SET NOT NULL;
  END IF;

  DROP INDEX IF EXISTS "users_email_key";

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_companyId_email_key'
  ) THEN
    CREATE UNIQUE INDEX "users_companyId_email_key" ON "users"("companyId", "email");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_companyId_idx'
  ) THEN
    CREATE INDEX "users_companyId_idx" ON "users"("companyId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'users' AND constraint_name = 'users_companyId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- deals.companyId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'companyId'
  ) THEN
    ALTER TABLE "deals" ADD COLUMN "companyId" TEXT;
  END IF;

  UPDATE "deals" SET "companyId" = default_id WHERE "companyId" IS NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'companyId'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "deals" ALTER COLUMN "companyId" SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'deals_companyId_idx'
  ) THEN
    CREATE INDEX "deals_companyId_idx" ON "deals"("companyId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'deals' AND constraint_name = 'deals_companyId_fkey'
  ) THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- manager_links.companyId
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manager_links'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'manager_links' AND column_name = 'companyId'
    ) THEN
      ALTER TABLE "manager_links" ADD COLUMN "companyId" TEXT;
    END IF;

    UPDATE "manager_links" SET "companyId" = default_id WHERE "companyId" IS NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'manager_links' AND column_name = 'companyId'
        AND is_nullable = 'YES'
    ) THEN
      ALTER TABLE "manager_links" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'manager_links_companyId_idx'
    ) THEN
      CREATE INDEX "manager_links_companyId_idx" ON "manager_links"("companyId");
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'manager_links'
        AND constraint_name = 'manager_links_companyId_fkey'
    ) THEN
      ALTER TABLE "manager_links" ADD CONSTRAINT "manager_links_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  -- audit_logs.companyId
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'companyId'
    ) THEN
      ALTER TABLE "audit_logs" ADD COLUMN "companyId" TEXT;
    END IF;

    UPDATE "audit_logs" SET "companyId" = default_id WHERE "companyId" IS NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'companyId'
        AND is_nullable = 'YES'
    ) THEN
      ALTER TABLE "audit_logs" ALTER COLUMN "companyId" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_logs_companyId_idx'
    ) THEN
      CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
        AND constraint_name = 'audit_logs_companyId_fkey'
    ) THEN
      ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Rebuild email_templates if still on old PK(key) schema
DO $$
DECLARE
  default_id TEXT;
BEGIN
  SELECT "id" INTO default_id FROM "companies" WHERE "slug" = 'default' LIMIT 1;
  IF default_id IS NULL THEN
    default_id := 'default_company_seed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'companyId'
  ) THEN
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
      default_id,
      "key", "name", "subject", "textBody", "htmlTitle", "description", "updatedAt", "updatedById"
    FROM "email_templates";

    DROP TABLE "email_templates";
    ALTER TABLE "email_templates_new" RENAME TO "email_templates";
    CREATE UNIQUE INDEX "email_templates_companyId_key_key" ON "email_templates"("companyId", "key");
    CREATE INDEX "email_templates_companyId_idx" ON "email_templates"("companyId");
    ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'telegram_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'telegram_templates' AND column_name = 'companyId'
  ) THEN
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
      default_id,
      "key", "name", "textBody", "description", "updatedAt", "updatedById"
    FROM "telegram_templates";

    DROP TABLE "telegram_templates";
    ALTER TABLE "telegram_templates_new" RENAME TO "telegram_templates";
    CREATE UNIQUE INDEX "telegram_templates_companyId_key_key" ON "telegram_templates"("companyId", "key");
    CREATE INDEX "telegram_templates_companyId_idx" ON "telegram_templates"("companyId");
    ALTER TABLE "telegram_templates" ADD CONSTRAINT "telegram_templates_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_stage_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_stage_messages' AND column_name = 'companyId'
  ) THEN
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
      default_id,
      "stage", "textBody", "updatedAt", "updatedById"
    FROM "client_stage_messages";

    DROP TABLE "client_stage_messages";
    ALTER TABLE "client_stage_messages_new" RENAME TO "client_stage_messages";
    CREATE UNIQUE INDEX "client_stage_messages_companyId_stage_key" ON "client_stage_messages"("companyId", "stage");
    CREATE INDEX "client_stage_messages_companyId_idx" ON "client_stage_messages"("companyId");
    ALTER TABLE "client_stage_messages" ADD CONSTRAINT "client_stage_messages_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
