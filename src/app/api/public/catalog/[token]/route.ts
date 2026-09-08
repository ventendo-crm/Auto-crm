import { withPublic } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getPublicCatalogVehicle } from "@/lib/services/catalog-vehicle-share";
import { serialize } from "@/lib/serialize";

export const GET = withPublic(async (_request, { params }) => {
  try {
    return ok(serialize(await getPublicCatalogVehicle(params.token)));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return error("Авто не найдено", 404);
      if (err.message === "EXPIRED") return error("Ссылка истекла", 410);
    }
    throw err;
  }
});
