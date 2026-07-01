import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";

function normalizeManagerPair(userId: string, peerId: string): [string, string] {
  if (userId === peerId) {
    throw new Error("INVALID_MANAGER_LINK");
  }
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

async function upsertManagerLink(userId: string, peerId: string, createdById: string) {
  const [userAId, userBId] = normalizeManagerPair(userId, peerId);

  return prisma.managerLink.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, createdById },
    update: {},
  });
}

/** Связывает нового менеджера со всей сетью того, кто его добавил. */
export async function linkManagers(createdById: string, peerId: string) {
  const networkIds = await getManagerVisibleManagerIds(createdById);
  let linked = 0;

  for (const memberId of networkIds) {
    if (memberId === peerId) {
      continue;
    }
    await upsertManagerLink(memberId, peerId, createdById);
    linked += 1;
  }

  return linked;
}

export async function getManagerPeerIds(managerId: string): Promise<string[]> {
  const links = await prisma.managerLink.findMany({
    where: {
      OR: [{ userAId: managerId }, { userBId: managerId }],
    },
    select: { userAId: true, userBId: true },
  });

  return links.map((link) => (link.userAId === managerId ? link.userBId : link.userAId));
}

export async function getManagerVisibleManagerIds(managerId: string): Promise<string[]> {
  const peers = await getManagerPeerIds(managerId);
  return [managerId, ...peers];
}

export async function deleteManagerLinksForUser(userId: string) {
  await prisma.managerLink.deleteMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
}

export async function backfillManagerLinksFromAudit(): Promise<number> {
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "User",
      action: "CREATE",
    },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      entityId: true,
      newValue: true,
    },
  });

  let linked = 0;

  for (const log of logs) {
    const role = (log.newValue as { role?: string } | null)?.role;
    if (role !== ROLES.MANAGER) {
      continue;
    }

    const [creator, created] = await Promise.all([
      prisma.user.findUnique({
        where: { id: log.userId },
        select: { id: true, role: { select: { name: true } } },
      }),
      prisma.user.findUnique({
        where: { id: log.entityId },
        select: { id: true, role: { select: { name: true } } },
      }),
    ]);

    if (!creator || !created) {
      continue;
    }

    if (creator.role.name !== ROLES.MANAGER || created.role.name !== ROLES.MANAGER) {
      continue;
    }

    if (creator.id === created.id) {
      continue;
    }

    const createdLinks = await linkManagers(creator.id, created.id);
    if (createdLinks > 0) {
      linked += createdLinks;
    }
  }

  return linked;
}
