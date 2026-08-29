import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { removeCatalogSelectionItem } from "@/lib/services/catalog-selections";
import { serialize } from "@/lib/serialize";

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const selection = await removeCatalogSelectionItem(user, params.id, params.itemId);
  return ok(serialize(selection));
});
