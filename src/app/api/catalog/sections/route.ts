import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  createCatalogSection,
  listCatalogSections,
} from "@/lib/services/catalog-sections";
import { createCatalogSectionSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  return ok(serialize(await listCatalogSections(user)));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = createCatalogSectionSchema.parse(await request.json());
    return created(serialize(await createCatalogSection(user, body)));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось создать раздел", 400);
  }
});
