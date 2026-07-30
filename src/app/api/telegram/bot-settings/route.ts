import { assertAllowed, assertFound, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyTelegram } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serializeCompanyBotSettings } from "@/lib/services/companies";
import {
  connectCompanyTelegramBot,
  disconnectCompanyTelegramBot,
} from "@/lib/telegram/bot";
import { serialize } from "@/lib/serialize";
import { connectTelegramBotSchema } from "@/lib/validators/companies";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyBotSettings(company)));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));

  const body = connectTelegramBotSchema.parse(await request.json());
  const result = await connectCompanyTelegramBot({
    companyId: user.companyId,
    token: body.token,
    defaultChatId: body.defaultChatId,
  });

  if (!result.ok) {
    return error(result.error, 400);
  }

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyBotSettings(company)));
});

export const DELETE = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));
  await disconnectCompanyTelegramBot(user.companyId);

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyBotSettings(company)));
});
