-- AlterTable
ALTER TABLE "search_process_entries" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Опубликовать уже существующие варианты, чтобы клиенты ничего не потеряли
UPDATE "search_process_entries" SET "publishedAt" = "updatedAt" WHERE "publishedAt" IS NULL;
