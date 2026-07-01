-- CreateTable
CREATE TABLE "manager_links" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manager_links_userAId_userBId_key" ON "manager_links"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "manager_links_userAId_idx" ON "manager_links"("userAId");

-- CreateIndex
CREATE INDEX "manager_links_userBId_idx" ON "manager_links"("userBId");

-- AddForeignKey
ALTER TABLE "manager_links" ADD CONSTRAINT "manager_links_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_links" ADD CONSTRAINT "manager_links_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
