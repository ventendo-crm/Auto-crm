import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { addCatalogSelectionItem } from "@/lib/services/catalog-selections";
import { addSelectionItemSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = addSelectionItemSchema.parse(await request.json());
  const selection = await addCatalogSelectionItem(user, params.id, body);
  return ok(serialize(selection));
});
