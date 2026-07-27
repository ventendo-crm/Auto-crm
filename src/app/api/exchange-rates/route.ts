import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { fetchGoogleFinanceRates } from "@/lib/customs-calculator/google-finance-rates";
import { canAccessCalculator } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export const GET = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));

  const force = new URL(request.url).searchParams.get("force") === "1";

  try {
    const result = await fetchGoogleFinanceRates({ force });
    return ok(serialize(result));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось загрузить курсы с Google Finance";
    return error(message, 502);
  }
});
