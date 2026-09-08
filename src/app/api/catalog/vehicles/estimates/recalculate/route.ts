import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  getCatalogExchangeRates,
  recalculateActiveCatalogEstimates,
} from "@/lib/services/catalog-estimates";
import { serialize } from "@/lib/serialize";
import { catalogRecalculateRatesSchema } from "@/lib/validators/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const result = await getCatalogExchangeRates(user);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof Error && err.message === "RATES_UNAVAILABLE") {
      return error("Не удалось загрузить курсы. Проверьте значения вручную.", 502);
    }
    throw err;
  }
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Укажите курсы валют", 400);
  }

  const parsed = catalogRecalculateRatesSchema.safeParse(body);
  if (!parsed.success) {
    return error("Проверьте курсы валют", 400);
  }

  const result = await recalculateActiveCatalogEstimates(user, parsed.data.rates);
  return ok(serialize(result));
});
