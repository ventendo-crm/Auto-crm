-- Связать менеджеров, которых создавал другой менеджер (по audit_logs).
INSERT INTO "manager_links" ("id", "userAId", "userBId", "createdById", "createdAt", "updatedAt")
SELECT DISTINCT ON (pairs."userAId", pairs."userBId")
  substr(md5('mgrlink_' || pairs."userAId" || '_' || pairs."userBId"), 1, 25),
  pairs."userAId",
  pairs."userBId",
  pairs."createdById",
  pairs."createdAt",
  pairs."createdAt"
FROM (
  SELECT
    LEAST(creator."id", created."id") AS "userAId",
    GREATEST(creator."id", created."id") AS "userBId",
    creator."id" AS "createdById",
    al."createdAt" AS "createdAt"
  FROM "audit_logs" al
  INNER JOIN "users" created ON created."id" = al."entityId"
  INNER JOIN "roles" created_role ON created_role."id" = created."roleId"
  INNER JOIN "users" creator ON creator."id" = al."userId"
  INNER JOIN "roles" creator_role ON creator_role."id" = creator."roleId"
  WHERE al."entity" = 'User'
    AND al."action" = 'CREATE'
    AND created_role."name" = 'MANAGER'
    AND creator_role."name" = 'MANAGER'
    AND creator."id" <> created."id"
    AND COALESCE(al."newValue"->>'role', '') = 'MANAGER'
) pairs
WHERE NOT EXISTS (
  SELECT 1
  FROM "manager_links" ml
  WHERE ml."userAId" = pairs."userAId"
    AND ml."userBId" = pairs."userBId"
);
