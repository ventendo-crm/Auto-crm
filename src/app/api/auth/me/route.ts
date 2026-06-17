import { assertFound, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  const dbUser = assertFound(
    await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        telegramChatId: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    }),
  );

  return ok(serialize(dbUser));
});
