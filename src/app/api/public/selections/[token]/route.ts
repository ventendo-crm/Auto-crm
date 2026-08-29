import { withPublic } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getPublicCatalogSelection } from "@/lib/services/catalog-selections";
import { serialize } from "@/lib/serialize";

export const GET = withPublic(async (_request, { params }) => {
  try {
    const data = await getPublicCatalogSelection(params.token);
    return ok(serialize(data));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return error("Подборка не найдена", 404);
      if (err.message === "REVOKED") return error("Ссылка отозвана", 410);
      if (err.message === "EXPIRED") return error("Ссылка истекла", 410);
    }
    throw err;
  }
});
