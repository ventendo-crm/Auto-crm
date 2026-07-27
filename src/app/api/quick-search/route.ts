import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCalculator } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import { searchWithTavily } from "@/lib/tavily/search";
import { quickSearchSchema } from "@/lib/validators/quick-search";

export const runtime = "nodejs";

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));

  const body = quickSearchSchema.parse(await request.json());

  try {
    const result = await searchWithTavily(body.query);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "TAVILY_NOT_CONFIGURED") {
        return error("Быстрый поиск не настроен: добавьте TAVILY_API_KEY", 503);
      }
      if (err.message === "TAVILY_EMPTY") {
        return error("Не удалось найти ответ по этому запросу", 404);
      }
      if (err.message === "TAVILY_REQUEST_FAILED") {
        return error("Сервис поиска временно недоступен", 502);
      }
    }
    throw err;
  }
});
