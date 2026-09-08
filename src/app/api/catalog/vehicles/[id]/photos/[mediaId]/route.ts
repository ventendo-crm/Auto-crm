import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { deleteCatalogVehiclePhoto } from "@/lib/services/catalog-vehicle-photos";
import { serialize } from "@/lib/serialize";

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const vehicle = await deleteCatalogVehiclePhoto(user, params.id, params.mediaId);
    return ok(serialize(vehicle));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Фото не найдено", 404);
    }
    throw err;
  }
});
