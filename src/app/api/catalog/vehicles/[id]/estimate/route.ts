import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  autoEstimateCatalogVehicle,
  getCatalogVehicleEstimate,
  upsertCatalogVehicleEstimate,
} from "@/lib/services/catalog-estimates";
import { catalogEstimateSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const estimate = await getCatalogVehicleEstimate(user, params.id);
  return ok(serialize(estimate));
});

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const body = catalogEstimateSchema.parse(await request.json());
    const estimate = await upsertCatalogVehicleEstimate(user, params.id, body);
    return ok(serialize(estimate));
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CALCULATION") {
      return error("Не удалось рассчитать стоимость с текущими параметрами", 422);
    }
    throw err;
  }
});

export const PUT = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const estimate = await autoEstimateCatalogVehicle(user, params.id);
    return ok(serialize(estimate));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INSUFFICIENT_DATA") {
        return error("Для авторасчёта нужны цена и год выпуска", 422);
      }
      if (err.message === "INVALID_CALCULATION") {
        return error("Не удалось рассчитать стоимость", 422);
      }
    }
    throw err;
  }
});
