import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { AI_QUICK_SEARCH_ENABLED } from "@/lib/features";
import { assertCompanyCalculatorAccess } from "@/lib/services/company-workspace";
import { serialize } from "@/lib/serialize";
import {
  refillMissingSpecs,
  searchWithTavily,
  TavilySearchError,
} from "@/lib/tavily/search";
import { quickSearchBodySchema } from "@/lib/validators/quick-search";

export const runtime = "nodejs";

export const POST = withAuth(async (request, { user }) => {
  if (!AI_QUICK_SEARCH_ENABLED) {
    return error("ИИ-поиск временно отключён", 503);
  }

  await assertCompanyCalculatorAccess(user);

  const body = quickSearchBodySchema.parse(await request.json());

  try {
    const result =
      body.mode === "refill"
        ? await refillMissingSpecs(
            body.query,
            {
              ...body.base,
              batteryRangeKm: body.base.batteryRangeKm ?? null,
              drivetrain: body.base.drivetrain ?? null,
              trimTags: body.base.trimTags ?? null,
            },
            body.missing,
          )
        : await searchWithTavily(body.query);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof TavilySearchError) {
      const status =
        err.code === "TAVILY_NOT_CONFIGURED"
          ? 503
          : err.code === "TAVILY_UNAUTHORIZED"
            ? 401
            : err.code === "TAVILY_EMPTY"
              ? 404
              : err.code === "TAVILY_NETWORK"
                ? 502
                : 502;
      return error(err.message, status);
    }
    throw err;
  }
});
