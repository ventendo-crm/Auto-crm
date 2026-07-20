INSERT INTO "documents" ("id", "dealId", "type", "status")
SELECT
  substr(md5(d."id" || '_PASSPORT_NOTARIZED_COPY'), 1, 25),
  d."id",
  'PASSPORT_NOTARIZED_COPY'::"DocumentType",
  'MISSING'::"DocumentStatus"
FROM "deals" d
WHERE NOT EXISTS (
  SELECT 1
  FROM "documents" doc
  WHERE doc."dealId" = d."id" AND doc."type" = 'PASSPORT_NOTARIZED_COPY'
);
