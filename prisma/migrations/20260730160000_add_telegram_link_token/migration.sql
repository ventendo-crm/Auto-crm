-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramLinkToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramLinkTokenExpiresAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_telegramLinkToken_key'
  ) THEN
    CREATE UNIQUE INDEX "users_telegramLinkToken_key" ON "users"("telegramLinkToken");
  END IF;
END $$;
