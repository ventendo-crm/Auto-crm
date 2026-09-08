-- Catalog vehicle trims: several configurations per model.
-- Runs from docker/entrypoint.sh before `prisma db push` so estimates are
-- remapped before Prisma drops catalogVehicleId.

CREATE TABLE IF NOT EXISTS "catalog_vehicle_trims" (
  "id" TEXT NOT NULL,
  "catalogVehicleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_vehicle_trims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "catalog_vehicle_trims_catalogVehicleId_sortOrder_idx"
  ON "catalog_vehicle_trims" ("catalogVehicleId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_vehicle_trims_catalogVehicleId_fkey'
  ) THEN
    ALTER TABLE "catalog_vehicle_trims"
      ADD CONSTRAINT "catalog_vehicle_trims_catalogVehicleId_fkey"
      FOREIGN KEY ("catalogVehicleId") REFERENCES "catalog_vehicles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "catalog_vehicle_trims" ("id", "catalogVehicleId", "title", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v."id", 'Базовая', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "catalog_vehicles" v
WHERE NOT EXISTS (
  SELECT 1 FROM "catalog_vehicle_trims" t WHERE t."catalogVehicleId" = v."id"
);

ALTER TABLE "catalog_vehicle_customs_estimates"
  ADD COLUMN IF NOT EXISTS "catalogVehicleTrimId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_vehicle_customs_estimates'
      AND column_name = 'catalogVehicleId'
  ) THEN
    UPDATE "catalog_vehicle_customs_estimates" e
    SET "catalogVehicleTrimId" = t."id"
    FROM "catalog_vehicle_trims" t
    WHERE e."catalogVehicleTrimId" IS NULL
      AND t."catalogVehicleId" = e."catalogVehicleId";
  END IF;
END $$;

DELETE FROM "catalog_vehicle_customs_estimates"
WHERE "catalogVehicleTrimId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_vehicle_customs_estimates'
      AND column_name = 'catalogVehicleTrimId'
  ) THEN
    ALTER TABLE "catalog_vehicle_customs_estimates"
      ALTER COLUMN "catalogVehicleTrimId" SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_vehicle_customs_estimates_catalogVehicleTrimId_key"
  ON "catalog_vehicle_customs_estimates" ("catalogVehicleTrimId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_vehicle_customs_estimates_catalogVehicleTrimId_fkey'
  ) THEN
    ALTER TABLE "catalog_vehicle_customs_estimates"
      ADD CONSTRAINT "catalog_vehicle_customs_estimates_catalogVehicleTrimId_fkey"
      FOREIGN KEY ("catalogVehicleTrimId") REFERENCES "catalog_vehicle_trims"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "catalog_vehicle_customs_estimates"
  DROP CONSTRAINT IF EXISTS "catalog_vehicle_customs_estimates_catalogVehicleId_fkey";

DROP INDEX IF EXISTS "catalog_vehicle_customs_estimates_catalogVehicleId_key";

ALTER TABLE "catalog_vehicle_customs_estimates"
  DROP COLUMN IF EXISTS "catalogVehicleId";

ALTER TABLE "catalog_vehicle_share_tokens"
  ADD COLUMN IF NOT EXISTS "visibleTrimIds" JSONB NOT NULL DEFAULT '[]';
