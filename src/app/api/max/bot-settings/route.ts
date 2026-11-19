import { assertAllowed, assertFound, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyTelegram } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serializeCompanyMaxBotSettings } from "@/lib/services/companies";
import { connectCompanyMaxBot, disconnectCompanyMaxBot } from "@/lib/max/bot";
import { serialize } from "@/lib/serialize";
import { connectMaxBotSchema } from "@/lib/validators/companies";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyMaxBotSettings(company)));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));

  const body = connectMaxBotSchema.parse(await request.json());
  const result = await connectCompanyMaxBot({
    companyId: user.companyId,
    token: body.token,
  });

  if (!result.ok) {
    return error(result.error, 400);
  }

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyMaxBotSettings(company)));
});

export const DELETE = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));
  await disconnectCompanyMaxBot(user.companyId);

  const company = assertFound(
    await prisma.company.findUnique({
      where: { id: user.companyId },
    }),
  );

  return ok(serialize(serializeCompanyMaxBotSettings(company)));
});
