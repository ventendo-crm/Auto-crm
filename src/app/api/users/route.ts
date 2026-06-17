import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { createUser } from "@/lib/services/users";
import { serialize } from "@/lib/serialize";
import { createManagerSchema, createUserSchema } from "@/lib/validators/user";
export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageUsers(user.role));

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      telegramChatId: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
      clientDeal: { select: { id: true, clientName: true } },
      _count: { select: { deals: true } },    },
  });

  return ok(serialize(users));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageUsers(user.role));

  const rawBody = await request.json();
  const body = createUserSchema.safeParse(rawBody);

  try {
    const payload = body.success
      ? body.data
      : { ...createManagerSchema.parse(rawBody), role: "MANAGER" as const };

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