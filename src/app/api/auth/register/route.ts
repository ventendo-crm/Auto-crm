import { hashPassword } from "@/lib/auth";
import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import { registerSchema } from "@/lib/validators/auth";
import { createAuditLog } from "@/lib/services/audit";

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageUsers(user.role));

  const body = registerSchema.parse(await request.json());

  const role = await prisma.role.findUnique({ where: { id: body.roleId } });
  if (!role) {
    return Response.json({ success: false, error: "Роль не найдена" }, { status: 404 });
  }

  if (role.name === "ADMIN") {
    return Response.json(
      { success: false, error: "Создание администратора через эту форму запрещено" },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  });
  if (existing) {
    return Response.json({ success: false, error: "Email уже зарегистрирован" }, { status: 409 });
  }

  const passwordHash = await hashPassword(body.password);
  const createdUser = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      roleId: body.roleId,
      telegramChatId: body.telegramChatId ?? null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      telegramChatId: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "User",
    entityId: createdUser.id,
    action: "CREATE",
    newValue: { email: createdUser.email, role: role.name },
  });

  return created(serialize(createdUser));
});
