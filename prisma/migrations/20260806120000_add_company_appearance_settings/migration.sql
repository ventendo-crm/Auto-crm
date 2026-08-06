-- CreateTable
CREATE TABLE IF NOT EXISTS "company_appearance_settings" (
  "companyId" TEXT NOT NULL,
  "presetId" TEXT NOT NULL DEFAULT 'classic',
  "customBrandHsl" TEXT,
  "logoUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_appearance_settings_pkey" PRIMARY KEY ("companyId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_appearance_settings_companyId_fkey'
  ) THEN
    ALTER TABLE "company_appearance_settings"
      ADD CONSTRAINT "company_appearance_settings_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
