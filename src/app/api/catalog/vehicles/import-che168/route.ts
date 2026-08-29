import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { ChinaFetchError } from "@/lib/http/china-fetch";
import { canAccessCatalog } from "@/lib/permissions";
import { importCatalogVehicleFromChe168 } from "@/lib/services/catalog-vehicles";
import { importChe168Schema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = importChe168Schema.parse(await request.json());
    const result = await importCatalogVehicleFromChe168(user, body);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof ChinaFetchError) {
      return error(err.message, 502);
    }
    if (err instanceof Error) {
      if (err.message === "NOT_CHE168") {
        return error("Поддерживаются только ссылки на che168.com", 422);
      }
      if (err.message === "EMPTY_URL") {
        return error("Укажите ссылку на объявление", 422);
      }
    }
    throw err;
  }
});
