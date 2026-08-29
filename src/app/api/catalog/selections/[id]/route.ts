import { withAuth, assertAllowed } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  deleteCatalogSelection,
  getCatalogSelection,
  updateCatalogSelection,
} from "@/lib/services/catalog-selections";
import { updateCatalogSelectionSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const selection = await getCatalogSelection(user, params.id);
  return ok(serialize(selection));
});

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = updateCatalogSelectionSchema.parse(await request.json());
  const selection = await updateCatalogSelection(user, params.id, body);
  return ok(serialize(selection));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  await deleteCatalogSelection(user, params.id);
  return noContent();
});
