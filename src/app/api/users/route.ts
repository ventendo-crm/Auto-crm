import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageManagers, canManageUsers, ROLES } from "@/lib/permissions";
import { createUser, mapUserListItem, userListSelect } from "@/lib/services/users";
import { serialize } from "@/lib/serialize";
import { createManagerSchema, createUserSchema } from "@/lib/validators/user";

export const GET = withAuth(async (_request, { user }) => {
  const isAdmin = canManageUsers(user.role);
  assertAllowed(isAdmin || canManageManagers(user.role));

  const users = await prisma.user.findMany({
    where: isAdmin ? undefined : { role: { name: ROLES.MANAGER } },
    orderBy: { name: "asc" },
    select: userListSelect,
  });

  return ok(serialize(users.map(mapUserListItem)));
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
