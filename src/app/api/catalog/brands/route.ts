import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { listCatalogBrands } from "@/lib/services/catalog-vehicles";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const brands = await listCatalogBrands(user);
  return ok(serialize(brands));
});
