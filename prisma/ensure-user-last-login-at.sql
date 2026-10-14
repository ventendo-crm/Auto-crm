-- Idempotent: last successful CRM login timestamp on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
