CREATE TABLE IF NOT EXISTS "search_process_entry_customs_estimates" (
  "id" TEXT NOT NULL,
  "searchProcessEntryId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "powerHp" INTEGER NOT NULL,
  "volumeCc" INTEGER NOT NULL,
  "carYear" INTEGER NOT NULL,
  "input" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "totalWithCar" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_process_entry_customs_estimates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_process_entry_customs_estimates_searchProcessEntryId_key"
  ON "search_process_entry_customs_estimates"("searchProcessEntryId");

CREATE INDEX IF NOT EXISTS "search_process_entry_customs_estimates_createdById_idx"
  ON "search_process_entry_customs_estimates"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_process_entry_customs_estimates_searchProcessEntryId_fkey'
  ) THEN
    ALTER TABLE "search_process_entry_customs_estimates"
      ADD CONSTRAINT "search_process_entry_customs_estimates_searchProcessEntryId_fkey"
      FOREIGN KEY ("searchProcessEntryId") REFERENCES "search_process_entries"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_process_entry_customs_estimates_createdById_fkey'
  ) THEN
    ALTER TABLE "search_process_entry_customs_estimates"
      ADD CONSTRAINT "search_process_entry_customs_estimates_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
