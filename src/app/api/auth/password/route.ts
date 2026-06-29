import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { changePasswordSchema } from "@/lib/validators/auth";

export const PATCH = withAuth(async (request, { user }) => {
  const body = changePasswordSchema.parse(await request.json());

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!dbUser) {
    throw new Error("Not found");
  }

  const valid = await verifyPassword(body.currentPassword, dbUser.passwordHash);
  if (!valid) {
    throw new Error("Неверный текущий пароль");
  }

  const passwordHash = await hashPassword(body.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await createAuditLog({
    userId: user.id,
    entity: "User",
    entityId: user.id,
    action: "UPDATE",
    newValue: { field: "password" },
  });

  return ok({ message: "Пароль изменён" });
});
