-- Idempotent: deal custom fields, document type as text, company workspace settings.
-- Runs from docker/entrypoint.sh before `prisma db push`, which can fail on enum→text.

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "customFields" JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'type'
      AND udt_name <> 'text'
  ) THEN
    ALTER TABLE "documents" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "company_workspace_settings" (
  "companyId" TEXT NOT NULL,
  "stageLabels" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "clientVisibleStages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "dealTabs" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dealFields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "customDealFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "documentTypes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "additionalOptionGroups" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "modules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_workspace_settings_pkey" PRIMARY KEY ("companyId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_workspace_settings_companyId_fkey'
  ) THEN
    ALTER TABLE "company_workspace_settings"
      ADD CONSTRAINT "company_workspace_settings_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
