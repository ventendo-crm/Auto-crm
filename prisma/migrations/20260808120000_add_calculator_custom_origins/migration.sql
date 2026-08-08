-- AlterTable
ALTER TABLE "company_calculator_settings"
  ADD COLUMN IF NOT EXISTS "customOrigins" JSONB NOT NULL DEFAULT '[]';
