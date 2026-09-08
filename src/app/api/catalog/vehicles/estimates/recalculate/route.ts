import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { recalculateActiveCatalogEstimates } from "@/lib/services/catalog-estimates";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const result = await recalculateActiveCatalogEstimates(user);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof Error && err.message === "RATES_UNAVAILABLE") {
      return error("Не удалось загрузить курсы. Попробуйте позже или задайте их в калькуляторе.", 502);
    }
    throw err;
  }
});
