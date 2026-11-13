ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "reminders_completed_notifiedAt_idx" ON "reminders"("completed", "notifiedAt");
