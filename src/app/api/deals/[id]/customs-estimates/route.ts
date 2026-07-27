import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { canCreateCustomsEstimates } from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import {
  createDealCustomsEstimate,
  listDealCustomsEstimates,
} from "@/lib/services/deal-customs-estimates";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { createCustomsEstimateSchema } from "@/lib/validators/customs-estimate";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const estimates = await listDealCustomsEstimates(params.id);
  return ok(serialize(estimates));
});

export const POST = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!canCreateCustomsEstimates(user.role, user.id, deal)) {
    assertAllowed(false);
  }

  const body = createCustomsEstimateSchema.parse(await request.json());

  try {
    const estimate = await createDealCustomsEstimate(user, params.id, body);
    return created(serialize(estimate));
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CALCULATION") {
      return error("Не удалось рассчитать по указанным параметрам", 400);
    }
    throw err;
  }
});
