import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, RoleName } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { linkManagers } from "@/lib/services/manager-links";
import { getRoleByName } from "@/lib/services/roles";
import { staffRoleSchema } from "@/lib/validators/user";
import { z } from "zod";

type StaffRoleName = z.infer<typeof staffRoleSchema>;

const STAFF_ROLES: StaffRoleName[] = ["ADMIN", "MANAGER", "VIEWER"];

function isStaffRoleName(role: string): role is StaffRoleName {
  return STAFF_ROLES.includes(role as StaffRoleName);
}

export async function createUser(params: {
  actorId: string;
  name: string;
  email: string;
  password: string;
  roleName: StaffRoleName;
}) {
  const role = await getRoleByName(params.roleName);
  if (!role) {
    throw new Error(`ROLE_NOT_FOUND:${params.roleName}`);
  }

  const email = params.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(params.password);

  const user = await prisma.user.create({
    data: {
      name: params.name.trim(),
      email,
      passwordHash,
      roleId: role.id,
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
    userId: params.actorId,
    entity: "User",
    entityId: user.id,
    action: "CREATE",
    newValue: { email: user.email, role: role.name },
  });

  const actor = await prisma.user.findUnique({
    where: { id: params.actorId },
    select: { role: { select: { name: true } } },
  });

  if (actor?.role.name === ROLES.MANAGER && params.roleName === ROLES.MANAGER) {
    await linkManagers(params.actorId, user.id);
  }

  return user;
}

export async function createManagerUser(params: {
  actorId: string;
  name: string;
  email: string;
  password: string;
}) {
  return createUser({ ...params, roleName: ROLES.MANAGER });
}

export const userListSelect = {
  id: true,
  name: true,
  email: true,
  telegramChatId: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  clientDeal: { select: { id: true, clientName: true } },
  _count: { select: { dealManagerAssignments: true } },
} as const;

export function mapUserListItem<
  T extends { _count: { dealManagerAssignments: number } & Record<string, number> },
>(user: T) {
  const { _count, ...rest } = user;
  const { dealManagerAssignments, ...otherCounts } = _count;
  return {
    ...rest,
    _count: {
      ...otherCounts,
      deals: dealManagerAssignments,
    },
  };
}

export async function deleteUser(params: { actorId: string; userId: string }) {
  if (params.actorId === params.userId) {
    throw new Error("CANNOT_DELETE_SELF");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      role: { select: { name: true } },
      clientDeal: { select: { id: true, clientName: true } },
      _count: {
        select: {
          dealManagerAssignments: true,
          comments: true,
          stageChanges: true,
          createdTasks: true,
          uploadedMedia: true,
          uploadedDocuments: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("NOT_FOUND");
  }

  const roleName = user.role.name as RoleName;

  if (roleName === ROLES.CLIENT) {
    await prisma.$transaction(async (tx) => {
      if (user.clientDeal) {
        await tx.deal.update({
          where: { id: user.clientDeal.id },
          data: { clientUserId: null },
        });
      }

      await tx.document.updateMany({
        where: { uploadedById: params.userId },
        data: { uploadedById: null },
      });
      await tx.comment.deleteMany({ where: { authorId: params.userId } });
      await tx.notification.deleteMany({ where: { userId: params.userId } });
      await tx.auditLog.deleteMany({ where: { userId: params.userId } });
      await tx.user.delete({ where: { id: params.userId } });
    });

    await createAuditLog({
      userId: params.actorId,
      entity: "User",
      entityId: params.userId,
      action: "DELETE",
      oldValue: {
        email: user.email,
        role: roleName,
        clientDealId: user.clientDeal?.id ?? null,
      },
    });

    return { id: params.userId };
  }

  if (!isStaffRoleName(roleName)) {
    throw new Error("UNSUPPORTED_ROLE");
  }

  if (user._count.dealManagerAssignments > 0) {
    throw new Error(`USER_HAS_DEALS:${user._count.dealManagerAssignments}`);
  }

  const activityCount =
    user._count.comments +
    user._count.stageChanges +
    user._count.createdTasks +
    user._count.uploadedMedia +
    user._count.uploadedDocuments;

  if (activityCount > 0) {
    throw new Error("USER_HAS_ACTIVITY");
  }

  if (roleName === ROLES.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: { name: ROLES.ADMIN } },
    });

    if (adminCount <= 1) {
      throw new Error("LAST_ADMIN");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.managerLink.deleteMany({
      where: {
        OR: [{ userAId: params.userId }, { userBId: params.userId }],
      },
    });
    await tx.document.updateMany({
      where: { uploadedById: params.userId },
      data: { uploadedById: null },
    });
    await tx.notification.deleteMany({ where: { userId: params.userId } });
    await tx.auditLog.deleteMany({ where: { userId: params.userId } });
    await tx.user.delete({ where: { id: params.userId } });
  });

  await createAuditLog({
    userId: params.actorId,
    entity: "User",
    entityId: params.userId,
    action: "DELETE",
    oldValue: { email: user.email, role: roleName },
  });

  return { id: params.userId };
}

export async function deleteManagerUser(params: { actorId: string; userId: string }) {
  return deleteUser(params);
}
