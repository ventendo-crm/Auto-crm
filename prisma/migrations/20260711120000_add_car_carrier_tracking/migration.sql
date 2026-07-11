-- CreateTable
CREATE TABLE "car_carrier_tracking_points" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_carrier_tracking_points_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN "carCarrierTrackingPointId" TEXT;

-- CreateIndex
CREATE INDEX "car_carrier_tracking_points_dealId_idx" ON "car_carrier_tracking_points"("dealId");

-- CreateIndex
CREATE INDEX "car_carrier_tracking_points_sortOrder_idx" ON "car_carrier_tracking_points"("sortOrder");

-- CreateIndex
CREATE INDEX "media_files_carCarrierTrackingPointId_idx" ON "media_files"("carCarrierTrackingPointId");

-- AddForeignKey
ALTER TABLE "car_carrier_tracking_points" ADD CONSTRAINT "car_carrier_tracking_points_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_carCarrierTrackingPointId_fkey" FOREIGN KEY ("carCarrierTrackingPointId") REFERENCES "car_carrier_tracking_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
