-- AlterTable
ALTER TABLE "catalog_vehicle_trims" ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT NOT NULL DEFAULT '';
ALTER TABLE "catalog_vehicle_trims" ADD COLUMN IF NOT EXISTS "descriptionZh" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "catalogVehicleTrimId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_files_catalogVehicleTrimId_idx" ON "media_files"("catalogVehicleTrimId");

-- AddForeignKey
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
