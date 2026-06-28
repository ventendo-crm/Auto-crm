-- CreateTable
CREATE TABLE "deal_expenses" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_expenses_dealId_idx" ON "deal_expenses"("dealId");

-- AddForeignKey
ALTER TABLE "deal_expenses" ADD CONSTRAINT "deal_expenses_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
