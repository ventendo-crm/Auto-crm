import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { checkChinaProxyHealth } from "@/lib/catalog/translate";
import { serialize } from "@/lib/serialize";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";

export const GET = withAuth(async (_request, { user }) => {
  await assertCompanyCatalogAccess(user);
  const result = await checkChinaProxyHealth();
  return ok(serialize(result));
});
