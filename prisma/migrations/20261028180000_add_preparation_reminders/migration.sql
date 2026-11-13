DO $$ BEGIN
  CREATE TYPE "PreparationReminderRecipientMode" AS ENUM ('ASSIGNED', 'SPECIFIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "preparationReminderSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "company_preparation_reminder_settings" (
  "companyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalHours" INTEGER NOT NULL DEFAULT 24,
  "messageTemplate" TEXT NOT NULL,
  "recipientMode" "PreparationReminderRecipientMode" NOT NULL DEFAULT 'ASSIGNED',
  "specificManagerId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_preparation_reminder_settings_pkey" PRIMARY KEY ("companyId")
);

DO $$ BEGIN
  ALTER TABLE "company_preparation_reminder_settings"
    ADD CONSTRAINT "company_preparation_reminder_settings_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "company_preparation_reminder_settings"
    ADD CONSTRAINT "company_preparation_reminder_settings_specificManagerId_fkey"
    FOREIGN KEY ("specificManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "company_preparation_reminder_settings_specificManagerId_idx"
  ON "company_preparation_reminder_settings"("specificManagerId");
