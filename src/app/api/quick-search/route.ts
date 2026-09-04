import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { assertCompanyCalculatorAccess } from "@/lib/services/company-workspace";
import { serialize } from "@/lib/serialize";
import { searchWithTavily, TavilySearchError } from "@/lib/tavily/search";
import { quickSearchSchema } from "@/lib/validators/quick-search";

export const runtime = "nodejs";

export const POST = withAuth(async (request, { user }) => {
  await assertCompanyCalculatorAccess(user);

  const body = quickSearchSchema.parse(await request.json());

  try {
    const result = await searchWithTavily(body.query);
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
