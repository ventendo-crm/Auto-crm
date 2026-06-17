-- CreateTable
CREATE TABLE "deal_additional_options" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_additional_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_additional_options_dealId_idx" ON "deal_additional_options"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_additional_options_dealId_optionKey_key" ON "deal_additional_options"("dealId", "optionKey");

-- AddForeignKey
ALTER TABLE "deal_additional_options" ADD CONSTRAINT "deal_additional_options_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_additional_options" ADD CONSTRAINT "deal_additional_options_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
