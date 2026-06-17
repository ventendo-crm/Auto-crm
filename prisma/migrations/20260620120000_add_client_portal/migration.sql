-- Add client user link to deals
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "clientUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "deals_clientUserId_key" ON "deals"("clientUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_clientUserId_fkey'
  ) THEN
    ALTER TABLE "deals"
      ADD CONSTRAINT "deals_clientUserId_fkey"
      FOREIGN KEY ("clientUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure CLIENT role exists
INSERT INTO "roles" ("id", "name")
SELECT substr(md5('role_CLIENT'), 1, 25), 'CLIENT'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'CLIENT');
