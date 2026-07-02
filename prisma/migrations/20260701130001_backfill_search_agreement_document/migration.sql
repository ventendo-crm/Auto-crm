-- Backfill missing search agreement document slots for existing deals
INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_SEARCH_AGREEMENT'), 1, 25),
  d."id",
  'SEARCH_AGREEMENT'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'SEARCH_AGREEMENT'
);
