-- Backfill missing invoice document slots for existing deals
INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_INVOICE'), 1, 25),
  d."id",
  'INVOICE'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'INVOICE'
);
