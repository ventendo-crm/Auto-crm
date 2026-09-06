import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import {
  canCreateCustomAdditionalOption,
  canToggleAdditionalOption,
} from "@/lib/permissions";
import { canUserViewDeal } from "@/lib/services/deal-access";
import {
  createCustomAdditionalOption,
  listAdditionalOptions,
  toggleAdditionalOption,
} from "@/lib/services/additional-options";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import {
  createAdditionalOptionSchema,
  toggleAdditionalOptionSchema,
} from "@/lib/validators/additional-options";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));

  if (!(await canUserViewDeal(user, deal))) {
    assertAllowed(false);
  }

  const groups = await listAdditionalOptions(params.id);
  return ok(groups);
});

export const POST = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));

  assertAllowed(canCreateCustomAdditionalOption(user.role, user.id, deal));

  const body = createAdditionalOptionSchema.parse(await request.json());

  try {
    const record = await createCustomAdditionalOption(
      user,
      params.id,
      body.label,
      body.groupId,
    );
    return created(serialize(record));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return error("Сделка не найдена", 404);
    }
    if (err instanceof Error && err.message === "UNKNOWN_GROUP") {
      return error("Неизвестная категория", 400);
    }
    throw err;
  }
});

export const PATCH = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));

  assertAllowed(canToggleAdditionalOption(user.role, user.id, deal));

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
    if (err instanceof Error && err.message === "UNKNOWN_OPTION") {
      return error("Неизвестная опция", 400);
    }
    throw err;
  }
});
