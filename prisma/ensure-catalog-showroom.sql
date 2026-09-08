-- Catalog showroom: sections, RUB currency field, per-vehicle share tokens.
-- Runs from docker/entrypoint.sh before `prisma db push`.

CREATE TABLE IF NOT EXISTS "catalog_sections" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "catalog_sections_companyId_sortOrder_idx"
  ON "catalog_sections" ("companyId", "sortOrder");

ALTER TABLE "catalog_vehicles"
  ADD COLUMN IF NOT EXISTS "sectionId" TEXT;

ALTER TABLE "catalog_vehicles"
  ADD COLUMN IF NOT EXISTS "priceCurrency" TEXT NOT NULL DEFAULT 'CNY';

CREATE TABLE IF NOT EXISTS "catalog_vehicle_share_tokens" (
  "id" TEXT NOT NULL,
  "catalogVehicleId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "publicToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_vehicle_share_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_vehicle_share_tokens_tokenHash_key"
  ON "catalog_vehicle_share_tokens" ("tokenHash");

ALTER TABLE "catalog_vehicle_share_tokens"
  ADD COLUMN IF NOT EXISTS "publicToken" TEXT;

CREATE INDEX IF NOT EXISTS "catalog_vehicle_share_tokens_catalogVehicleId_idx"
  ON "catalog_vehicle_share_tokens" ("catalogVehicleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_sections_companyId_fkey'
  ) THEN
    ALTER TABLE "catalog_sections"
      ADD CONSTRAINT "catalog_sections_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_sections_createdById_fkey'
  ) THEN
    ALTER TABLE "catalog_sections"
      ADD CONSTRAINT "catalog_sections_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_vehicles_sectionId_fkey'
  ) THEN
    ALTER TABLE "catalog_vehicles"
      ADD CONSTRAINT "catalog_vehicles_sectionId_fkey"
      FOREIGN KEY ("sectionId") REFERENCES "catalog_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_vehicle_share_tokens_catalogVehicleId_fkey'
  ) THEN
    ALTER TABLE "catalog_vehicle_share_tokens"
      ADD CONSTRAINT "catalog_vehicle_share_tokens_catalogVehicleId_fkey"
      FOREIGN KEY ("catalogVehicleId") REFERENCES "catalog_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_vehicle_share_tokens_createdById_fkey'
  ) THEN
    ALTER TABLE "catalog_vehicle_share_tokens"
      ADD CONSTRAINT "catalog_vehicle_share_tokens_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Включаем модуль «Каталог» у компаний: раньше он был выключен (Che168).
UPDATE "company_workspace_settings"
SET "modules" = jsonb_set(COALESCE("modules", '{}'::jsonb), '{catalog}', 'true'::jsonb, true);
