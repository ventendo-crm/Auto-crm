-- Idempotent. Только добавление колонок: без DROP, чтобы ошибка
-- на чужой таблице не откатывала ALTER TABLE в одной транзакции.

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderIntervalDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderSendTime" TEXT NOT NULL DEFAULT '10:00';
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderTimeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow';
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderNextAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "deals_stageReminderNextAt_idx" ON "deals"("stageReminderNextAt");
