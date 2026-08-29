import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { checkChinaProxyHealth } from "@/lib/catalog/translate";
import { canAccessCatalog } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const result = await checkChinaProxyHealth();
  return ok(serialize(result));
});
