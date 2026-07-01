import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageManagers, canManageUsers, ROLES } from "@/lib/permissions";
import { createUser } from "@/lib/services/users";
import { linkManagers } from "@/lib/services/manager-links";
import { serialize } from "@/lib/serialize";
import { createManagerSchema, createUserSchema } from "@/lib/validators/user";

const userSelect = {
  id: true,
  name: true,
  email: true,
  telegramChatId: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  clientDeal: { select: { id: true, clientName: true } },
  _count: { select: { deals: true } },
} as const;

export const GET = withAuth(async (_request, { user }) => {
  const isAdmin = canManageUsers(user.role);
  assertAllowed(isAdmin || canManageManagers(user.role));

  const users = await prisma.user.findMany({
    where: isAdmin ? undefined : { role: { name: ROLES.MANAGER } },
    orderBy: { name: "asc" },
    select: userSelect,
  });

  return ok(serialize(users));
});

export const POST = withAuth(async (request, { user }) => {
  const isAdmin = canManageUsers(user.role);
  assertAllowed(isAdmin || canManageManagers(user.role));

  const rawBody = await request.json();
  const parsedUser = createUserSchema.safeParse(rawBody);

  try {
    const payload = parsedUser.success
      ? parsedUser.data
      : { ...createManagerSchema.parse(rawBody), role: ROLES.MANAGER };

    if (!isAdmin && payload.role !== ROLES.MANAGER) {
      assertAllowed(false);
    }

    const createdUser = await createUser({
      actorId: user.id,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roleName: payload.role,
    });

    if (!isAdmin && user.role === ROLES.MANAGER && payload.role === ROLES.MANAGER) {
      await linkManagers(user.id, createdUser.id);
    }

    return created(serialize(createdUser));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith("ROLE_NOT_FOUND:")) {
        return error(
          "Роль не найдена в базе. Выполните миграции: npx prisma migrate deploy",
          500,
        );
      }
      if (err.message === "EMAIL_EXISTS") {
        return error("Email уже зарегистрирован", 409);
      }
    }

    throw err;
  }
});
