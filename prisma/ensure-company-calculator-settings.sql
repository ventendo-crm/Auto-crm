-- Safe ensure for company calculator expense templates (idempotent).
CREATE TABLE IF NOT EXISTS company_calculator_settings (
  "companyId" TEXT PRIMARY KEY,
  "expenseItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT company_calculator_settings_companyId_fkey
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
);
