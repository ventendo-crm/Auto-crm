-- Per-trim description and photos for catalog vehicles.
-- Runs from docker/entrypoint.sh before `prisma db push`.

ALTER TABLE "catalog_vehicle_trims"
  ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT NOT NULL DEFAULT '';

ALTER TABLE "catalog_vehicle_trims"
  ADD COLUMN IF NOT EXISTS "descriptionZh" TEXT NOT NULL DEFAULT '';

UPDATE "catalog_vehicle_trims" t
SET
  "descriptionRu" = v."descriptionRu",
  "descriptionZh" = v."descriptionZh"
FROM "catalog_vehicles" v
WHERE t."catalogVehicleId" = v."id"
  AND t."descriptionRu" = ''
  AND t."descriptionZh" = ''
  AND t."id" = (
    SELECT t2."id"
    FROM "catalog_vehicle_trims" t2
    WHERE t2."catalogVehicleId" = t."catalogVehicleId"
    ORDER BY t2."sortOrder" ASC, t2."createdAt" ASC
    LIMIT 1
  );

ALTER TABLE "media_files"
  ADD COLUMN IF NOT EXISTS "catalogVehicleTrimId" TEXT;

UPDATE "media_files" m
SET "catalogVehicleTrimId" = t."id"
FROM "catalog_vehicle_trims" t
WHERE m."catalogVehicleId" IS NOT NULL
  AND m."catalogVehicleTrimId" IS NULL
  AND t."catalogVehicleId" = m."catalogVehicleId"
  AND t."id" = (
    SELECT t2."id"
    FROM "catalog_vehicle_trims" t2
    WHERE t2."catalogVehicleId" = m."catalogVehicleId"
    ORDER BY t2."sortOrder" ASC, t2."createdAt" ASC
    LIMIT 1
  );

CREATE INDEX IF NOT EXISTS "media_files_catalogVehicleTrimId_idx"
  ON "media_files" ("catalogVehicleTrimId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_files_catalogVehicleTrimId_fkey'
  ) THEN
    ALTER TABLE "media_files"
      ADD CONSTRAINT "media_files_catalogVehicleTrimId_fkey"
      FOREIGN KEY ("catalogVehicleTrimId") REFERENCES "catalog_vehicle_trims"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
