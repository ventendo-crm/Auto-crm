-- Backfill missing broker document slots for existing deals
INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_BROKER_SERVICES_RECEIPT'), 1, 25),
  d."id",
  'BROKER_SERVICES_RECEIPT'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'BROKER_SERVICES_RECEIPT'
);

INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_BROKER_PAYMENT_RECEIPT'), 1, 25),
  d."id",
  'BROKER_PAYMENT_RECEIPT'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'BROKER_PAYMENT_RECEIPT'
);
