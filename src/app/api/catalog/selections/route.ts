import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  createCatalogSelection,
  listCatalogSelections,
} from "@/lib/services/catalog-selections";
import { createCatalogSelectionSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const data = await listCatalogSelections(user);
  return ok(serialize(data));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = createCatalogSelectionSchema.parse(await request.json());
  const selection = await createCatalogSelection(user, body);
  return created(serialize(selection));
});
