-- Idempotent: password reset token columns on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiresAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'users_passwordResetTokenHash_key'
  ) THEN
    CREATE UNIQUE INDEX "users_passwordResetTokenHash_key" ON "users"("passwordResetTokenHash");
  END IF;
END $$;
