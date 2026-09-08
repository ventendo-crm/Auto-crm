import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { shareCatalogVehicle } from "@/lib/services/catalog-vehicle-share";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    return ok(serialize(await shareCatalogVehicle(user, params.id)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Авто не найдено или снято с витрины", 404);
    }
    throw err;
  }
});
