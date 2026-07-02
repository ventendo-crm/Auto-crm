import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canToggleAdditionalOption } from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import {
  listAdditionalOptions,
  toggleAdditionalOption,
} from "@/lib/services/additional-options";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { toggleAdditionalOptionSchema } from "@/lib/validators/additional-options";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const groups = await listAdditionalOptions(params.id);
  return ok(groups);
});

export const PATCH = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));

  assertAllowed(
    canToggleAdditionalOption(user.role, user.id, {
      managerId: deal.managerId,
      clientUserId: deal.clientUserId,
    }),
  );

  const body = toggleAdditionalOptionSchema.parse(await request.json());

  try {
    const record = await toggleAdditionalOption(
      user,
      params.id,
      body.optionKey,
      body.checked,
    );
    return ok(serialize(record));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Сделка не найдена", 404);
    }
    throw err;
  }
});
