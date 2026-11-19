import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getCompanyMaxConfig, isCompanyMaxConfigured, sendMaxMessageWithToken } from "@/lib/max/bot";
import { z } from "zod";

const schema = z.object({
  maxUserId: z.string().trim().min(1).max(32),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  telegramChatId: true,
  maxUserId: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
} as const;

export const PATCH = withAuth(async (request, { user }) => {
  const body = schema.parse(await request.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { maxUserId: body.maxUserId },
    select: userSelect,
  });

  const config = await getCompanyMaxConfig(user.companyId);
  if (isCompanyMaxConfigured(config) && config.token) {
    const delivered = await sendMaxMessageWithToken(
      config.token,
      body.maxUserId,
      "Auto-CRM\nMAX успешно привязан. Вы будете получать уведомления о сделках.",
    );

    if (!delivered) {
      throw new Error(
        "ID сохранён, но MAX не ответил. Напишите боту /start и проверьте ID.",
      );
    }
  }

  return ok(serialize(updated));
});

export const DELETE = withAuth(async (_request, { user }) => {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { maxUserId: null },
    select: userSelect,
  });

  return ok(serialize(updated));
});
