import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { error, noContent, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { deleteUser, mapUserListItem } from "@/lib/services/users";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  if (user.role !== "ADMIN" && user.id !== params.id) {
    assertAllowed(false);
  }

  const dbUser = assertFound(
    await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        telegramChatId: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
        _count: { select: { dealManagerAssignments: true, comments: true } },
      },
    }),
  );

  return ok(serialize(mapUserListItem(dbUser)));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canManageUsers(user.role));

  try {
    await deleteUser({ actorId: user.id, userId: params.id });
    return noContent();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Пользователь не найден", 404);
      }
      if (err.message === "UNSUPPORTED_ROLE") {
        return error("Нельзя удалить пользователя с этой ролью", 400);
      }
      if (err.message === "CANNOT_DELETE_SELF") {
        return error("Нельзя удалить свою учётную запись", 400);
      }
      if (err.message.startsWith("USER_HAS_DEALS:")) {
        const count = err.message.split(":")[1];
        return error(
          `У пользователя ${count} сделок. Переназначьте их другому менеджеру перед удалением.`,
          409,
        );
      }
      if (err.message === "USER_HAS_ACTIVITY") {
        return error(
          "У пользователя есть активность в системе (комментарии, медиа и т.д.). Удаление невозможно.",
          409,
        );
      }
      if (err.message === "LAST_ADMIN") {
        return error("Нельзя удалить последнего администратора", 409);
      }
    }

    throw err;
  }
});
