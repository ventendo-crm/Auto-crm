import { withAuth, assertAllowed } from "@/lib/api-handler";
import { noContent } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { revokeCatalogSelectionShareToken } from "@/lib/services/catalog-selections";

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  await revokeCatalogSelectionShareToken(user, params.id, params.tokenId);
  return noContent();
});
