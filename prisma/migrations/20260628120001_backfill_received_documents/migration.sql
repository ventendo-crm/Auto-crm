-- Backfill received document slots for existing deals
INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_EPTS'), 1, 25),
  d."id",
  'EPTS'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'EPTS'
);

INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_PTD'), 1, 25),
  d."id",
  'PTD'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'PTD'
);

INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_SBKTS'), 1, 25),
  d."id",
  'SBKTS'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'SBKTS'
);
