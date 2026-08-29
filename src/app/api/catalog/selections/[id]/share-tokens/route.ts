import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { createCatalogSelectionShareToken } from "@/lib/services/catalog-selections";
import { createShareTokenSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = createShareTokenSchema.parse(await request.json());
  const token = await createCatalogSelectionShareToken(user, params.id, body);
  return created(serialize(token));
});

export const GET = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const { getCatalogSelection } = await import("@/lib/services/catalog-selections");
  const selection = await getCatalogSelection(user, params.id);
  return ok(serialize({ shareTokens: selection.shareTokens }));
});
