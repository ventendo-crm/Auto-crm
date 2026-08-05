-- Safe ensure for company dashboard layout (idempotent).
CREATE TABLE IF NOT EXISTS company_dashboard_settings (
  "companyId" TEXT PRIMARY KEY,
  "layout" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT company_dashboard_settings_companyId_fkey
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
);
