-- CreateTable
CREATE TABLE "deal_manager_assignments" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_manager_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deal_manager_assignments_dealId_managerId_key" ON "deal_manager_assignments"("dealId", "managerId");

-- CreateIndex
CREATE INDEX "deal_manager_assignments_dealId_idx" ON "deal_manager_assignments"("dealId");

-- CreateIndex
CREATE INDEX "deal_manager_assignments_managerId_idx" ON "deal_manager_assignments"("managerId");

-- AddForeignKey
ALTER TABLE "deal_manager_assignments" ADD CONSTRAINT "deal_manager_assignments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_manager_assignments" ADD CONSTRAINT "deal_manager_assignments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single-manager assignments
INSERT INTO "deal_manager_assignments" ("id", "dealId", "managerId")
SELECT gen_random_uuid()::text, "id", "managerId"
FROM "deals"
WHERE "managerId" IS NOT NULL;
