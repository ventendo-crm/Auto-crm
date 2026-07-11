import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { created, error, noContent } from "@/lib/api-response";
import { canManageClientAccount } from "@/lib/permissions";
import {
  createClientAccount,
  unlinkClientAccount,
} from "@/lib/services/client-account";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { createClientAccountSchema } from "@/lib/validators/client-account";

export const POST = withAuth(async (request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));
  assertAllowed(canManageClientAccount(user.role, user.id, deal));

  const body = createClientAccountSchema.parse(await request.json());

  try {
    const clientUser = await createClientAccount(user, params.id, body);
    return created(serialize({ clientUser }));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CLIENT_ALREADY_LINKED") {
        return error("К этой сделке уже привязан личный кабинет клиента", 409);
      }
      if (err.message === "EMAIL_EXISTS") {
        return error("Email уже зарегистрирован", 409);
      }
      if (err.message === "CLIENT_ROLE_NOT_FOUND") {
        return error("Роль клиента не найдена в системе", 500);
      }
    }
    throw err;
  }
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id));
  assertAllowed(canManageClientAccount(user.role, user.id, deal));

  try {
    await unlinkClientAccount(user, params.id);
    return noContent();
  } catch (err) {
    if (err instanceof Error && err.message === "CLIENT_NOT_LINKED") {
      return error("Личный кабинет клиента не привязан", 404);
    }
    throw err;
  }
});
