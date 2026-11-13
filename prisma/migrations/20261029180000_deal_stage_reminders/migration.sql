ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderIntervalDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderNextAt" TIMESTAMP(3);

ALTER TABLE "deals" DROP COLUMN IF EXISTS "preparationReminderSentAt";

DROP TABLE IF EXISTS "company_preparation_reminder_settings";
DROP TYPE IF EXISTS "PreparationReminderRecipientMode";

CREATE INDEX IF NOT EXISTS "deals_stageReminderNextAt_idx" ON "deals"("stageReminderNextAt");
