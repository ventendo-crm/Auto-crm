-- CreateTable
CREATE TABLE "import_process_entries" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_process_entries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN "importProcessEntryId" TEXT;

-- CreateIndex
CREATE INDEX "import_process_entries_dealId_idx" ON "import_process_entries"("dealId");

-- CreateIndex
CREATE INDEX "import_process_entries_sortOrder_idx" ON "import_process_entries"("sortOrder");

-- CreateIndex
CREATE INDEX "media_files_importProcessEntryId_idx" ON "media_files"("importProcessEntryId");

-- AddForeignKey
ALTER TABLE "import_process_entries" ADD CONSTRAINT "import_process_entries_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_importProcessEntryId_fkey" FOREIGN KEY ("importProcessEntryId") REFERENCES "import_process_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
