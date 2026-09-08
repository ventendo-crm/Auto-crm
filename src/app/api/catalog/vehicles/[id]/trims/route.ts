import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { getCatalogVehicle } from "@/lib/services/catalog-vehicles";
import { createCatalogVehicleTrim } from "@/lib/services/catalog-trims";
import { serialize } from "@/lib/serialize";
import { createCatalogTrimSchema } from "@/lib/validators/catalog";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = createCatalogTrimSchema.parse(await request.json());
    await createCatalogVehicleTrim(user, params.id, body);
    return created(serialize(await getCatalogVehicle(user, params.id)));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Авто не найдено", 404);
    }
    if (err instanceof Error && err.message === "TRIM_LIMIT") {
      return error("Слишком много комплектаций в одной карточке", 422);
    }
    throw err;
  }
});
