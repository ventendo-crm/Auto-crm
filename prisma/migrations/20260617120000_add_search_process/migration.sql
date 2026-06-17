-- CreateTable
CREATE TABLE "search_process_entries" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_process_entries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN "searchProcessEntryId" TEXT;

-- CreateIndex
CREATE INDEX "search_process_entries_dealId_idx" ON "search_process_entries"("dealId");
CREATE INDEX "search_process_entries_sortOrder_idx" ON "search_process_entries"("sortOrder");
CREATE INDEX "media_files_searchProcessEntryId_idx" ON "media_files"("searchProcessEntryId");

-- AddForeignKey
ALTER TABLE "search_process_entries" ADD CONSTRAINT "search_process_entries_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_searchProcessEntryId_fkey" FOREIGN KEY ("searchProcessEntryId") REFERENCES "search_process_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
