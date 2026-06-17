-- Backfill missing document slots for existing deals
INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_CUSTOMS_DUTY'), 1, 25),
  d."id",
  'CUSTOMS_DUTY'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'CUSTOMS_DUTY'
);

INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_CUSTOMS_DUTY_RECEIPT'), 1, 25),
  d."id",
  'CUSTOMS_DUTY_RECEIPT'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'CUSTOMS_DUTY_RECEIPT'
);
