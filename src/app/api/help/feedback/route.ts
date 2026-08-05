import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessHelp } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  isFeedbackConfigured,
  sendHelpFeedback,
} from "@/lib/services/help-feedback";
import { helpFeedbackSchema } from "@/lib/validators/help-feedback";

export const GET = withAuth(async (_request, { user }) => {
  if (!canAccessHelp(user.role)) {
    return error("Forbidden", 403);
  }
  return ok({ configured: isFeedbackConfigured() });
});

export const POST = withAuth(async (request, { user }) => {
  if (!canAccessHelp(user.role)) {
    return error("Forbidden", 403);
  }

  const body = helpFeedbackSchema.parse(await request.json());

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
      company: { select: { name: true, slug: true } },
    },
  });

  if (!dbUser) {
    return error("Not found", 404);
  }

  const result = await sendHelpFeedback({
    topic: body.topic,
    message: body.message,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role.name,
      companyName: dbUser.company.name,
      companySlug: dbUser.company.slug,
    },
  });

  if (!result.ok) {
    return error(result.error, 503);
  }

  return ok({ message: "Сообщение отправлено. Мы ответим на ваш email." });
});
