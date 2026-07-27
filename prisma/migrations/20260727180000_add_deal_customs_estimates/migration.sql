-- CreateTable
CREATE TABLE "deal_customs_estimates" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "totalWithCar" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_customs_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_customs_estimates_dealId_createdAt_idx" ON "deal_customs_estimates"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "deal_customs_estimates_createdById_idx" ON "deal_customs_estimates"("createdById");

-- AddForeignKey
ALTER TABLE "deal_customs_estimates" ADD CONSTRAINT "deal_customs_estimates_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_customs_estimates" ADD CONSTRAINT "deal_customs_estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
