import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, noContent, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { deleteCatalogSection, updateCatalogSection } from "@/lib/services/catalog-sections";
import { updateCatalogSectionSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = updateCatalogSectionSchema.parse(await request.json());
    return ok(serialize(await updateCatalogSection(user, params.id, body)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Раздел не найден", 404);
    }
    throw err;
  }
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    await deleteCatalogSection(user, params.id);
    return noContent();
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Раздел не найден", 404);
    }
    throw err;
  }
});
