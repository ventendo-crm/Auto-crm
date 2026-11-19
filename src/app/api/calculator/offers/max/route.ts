import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { OFFER_TOKEN_PATTERN } from "@/lib/calculator/offer-share";
import { sendCalculatorOfferToManagerMax } from "@/lib/services/calculator-offers";
import { assertCompanyCalculatorAccess } from "@/lib/services/company-workspace";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().regex(OFFER_TOKEN_PATTERN),
});

export const POST = withAuth(async (request, { user }) => {
  await assertCompanyCalculatorAccess(user);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error("Некорректная ссылка подбора");
  }

  await sendCalculatorOfferToManagerMax(user, parsed.data.token);
  return ok({ delivered: true });
});
