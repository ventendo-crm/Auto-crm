import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { getCatalogVehicle } from "@/lib/services/catalog-vehicles";
import { deleteCatalogVehicleTrim, updateCatalogVehicleTrim } from "@/lib/services/catalog-trims";
import { serialize } from "@/lib/serialize";
import { updateCatalogTrimSchema } from "@/lib/validators/catalog";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = updateCatalogTrimSchema.parse(await request.json());
    await updateCatalogVehicleTrim(user, params.id, params.trimId, body);
    return ok(serialize(await getCatalogVehicle(user, params.id)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Комплектация не найдена", 404);
    }
    throw err;
  }
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    await deleteCatalogVehicleTrim(user, params.id, params.trimId);
    return ok(serialize(await getCatalogVehicle(user, params.id)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Комплектация не найдена", 404);
    }
    if (err instanceof Error && err.message === "LAST_TRIM") {
      return error("Нельзя удалить последнюю комплектацию", 422);
    }
    throw err;
  }
});
