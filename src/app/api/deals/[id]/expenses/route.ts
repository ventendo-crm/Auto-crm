import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageDealExpenses } from "@/lib/permissions";
import { listDealExpenses, replaceDealExpenses } from "@/lib/services/deal-expenses";
import { getDeal } from "@/lib/services/deals";
import { replaceDealExpensesSchema } from "@/lib/validators/deal-expenses";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!canManageDealExpenses(user.role, user.id, deal)) {
    assertAllowed(false);
  }

  const expenses = await listDealExpenses(params.id);
  return ok(expenses);
});

export const PUT = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!canManageDealExpenses(user.role, user.id, deal)) {
    assertAllowed(false);
  }

  const body = replaceDealExpensesSchema.parse(await request.json());

  try {
    const expenses = await replaceDealExpenses(user, params.id, deal.managerId, body);
    return ok(expenses);
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return error("Недостаточно прав", 403);
    }
    throw err;
  }
});
