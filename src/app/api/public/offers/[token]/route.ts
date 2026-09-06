import { withPublic } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getPublicCalculatorOffer } from "@/lib/services/calculator-offers";

export const GET = withPublic(async (_request, { params }) => {
  try {
    return ok(await getPublicCalculatorOffer(params.token));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return error("Подбор не найден", 404);
      if (err.message === "EXPIRED") return error("Ссылка истекла", 410);
    }
    throw err;
  }
});
