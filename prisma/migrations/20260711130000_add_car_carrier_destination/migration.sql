-- AlterTable
ALTER TABLE "deals" ADD COLUMN "carCarrierDestinationLat" DECIMAL(10,7);
ALTER TABLE "deals" ADD COLUMN "carCarrierDestinationLng" DECIMAL(10,7);
ALTER TABLE "deals" ADD COLUMN "carCarrierDestinationTitle" TEXT NOT NULL DEFAULT '';
