DO $$ BEGIN
  CREATE TYPE "GoogleCalendarSourceType" AS ENUM ('CUSTOMS', 'REMINDER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "company_google_calendar_settings" (
  "companyId" TEXT NOT NULL,
  "googleEmail" TEXT NOT NULL,
  "refreshTokenEnc" TEXT NOT NULL,
  "accessTokenEnc" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "calendarId" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_google_calendar_settings_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE IF NOT EXISTS "google_calendar_event_maps" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "sourceType" "GoogleCalendarSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "googleEventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_calendar_event_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_event_maps_companyId_sourceType_sourceId_key"
  ON "google_calendar_event_maps"("companyId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "google_calendar_event_maps_companyId_idx"
  ON "google_calendar_event_maps"("companyId");

CREATE INDEX IF NOT EXISTS "google_calendar_event_maps_dealId_idx"
  ON "google_calendar_event_maps"("dealId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_google_calendar_settings_companyId_fkey'
  ) THEN
    ALTER TABLE "company_google_calendar_settings"
      ADD CONSTRAINT "company_google_calendar_settings_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_event_maps_companyId_fkey'
  ) THEN
    ALTER TABLE "google_calendar_event_maps"
      ADD CONSTRAINT "google_calendar_event_maps_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
