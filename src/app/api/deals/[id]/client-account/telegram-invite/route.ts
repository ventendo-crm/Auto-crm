import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageClientAccount } from "@/lib/permissions";
import { getClientTelegramInvite } from "@/lib/services/client-account";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));
  assertAllowed(canManageClientAccount(user.role, user.id, deal));

  try {
    const invite = await getClientTelegramInvite({
      dealId: params.id,
      companyId: user.companyId,
    });
    return ok(serialize(invite));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CLIENT_NOT_LINKED") {
        return error("Сначала создайте личный кабинет клиента", 404);
      }
      if (err.message === "BOT_NOT_CONNECTED") {
        return error(
          "Сначала привяжите Telegram-бота компании в Настройки → Telegram",
          400,
        );
      }
    }
    throw err;
  }
});

export const POST = withAuth(async (_request, { user, params }) => {
  const deal = assertFound(await getDeal(params.id, user.companyId));
  assertAllowed(canManageClientAccount(user.role, user.id, deal));

  try {
    const invite = await getClientTelegramInvite({
      dealId: params.id,
      companyId: user.companyId,
      refresh: true,
    });
    return ok(serialize(invite));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CLIENT_NOT_LINKED") {
        return error("Сначала создайте личный кабинет клиента", 404);
      }
      if (err.message === "BOT_NOT_CONNECTED") {
        return error(
          "Сначала привяжите Telegram-бота компании в Настройки → Telegram",
          400,
        );
      }
    }
    throw err;
  }
});
