-- Ensure default roles exist (db push does not run data migrations)
INSERT INTO "roles" ("id", "name")
SELECT substr(md5('role_ADMIN'), 1, 25), 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'ADMIN');

INSERT INTO "roles" ("id", "name")
SELECT substr(md5('role_MANAGER'), 1, 25), 'MANAGER'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'MANAGER');

INSERT INTO "roles" ("id", "name")
SELECT substr(md5('role_VIEWER'), 1, 25), 'VIEWER'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'VIEWER');

INSERT INTO "roles" ("id", "name")
SELECT substr(md5('role_CLIENT'), 1, 25), 'CLIENT'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'CLIENT');
