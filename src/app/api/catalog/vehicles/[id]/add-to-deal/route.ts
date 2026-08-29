import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { addCatalogVehicleToDeal } from "@/lib/services/catalog-to-deal";
import { addCatalogVehicleToDealSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = addCatalogVehicleToDealSchema.parse(await request.json());
    const result = await addCatalogVehicleToDeal(user, params.id, body);
    return created(serialize(result));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Сделка или объявление не найдены", 404);
    }
    throw err;
  }
});
