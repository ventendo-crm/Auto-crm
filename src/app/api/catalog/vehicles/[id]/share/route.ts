import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { shareCatalogVehicle } from "@/lib/services/catalog-vehicle-share";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  try {
    return ok(serialize(await shareCatalogVehicle(user, params.id, body)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Авто не найдено или снято с витрины", 404);
    }
    if (err instanceof Error && err.message === "TRIMS_REQUIRED") {
      return error("Выберите хотя бы одну комплектацию", 400);
    }
    throw err;
  }
});
