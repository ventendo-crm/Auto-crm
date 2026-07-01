import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";

function normalizeManagerPair(userId: string, peerId: string): [string, string] {
  if (userId === peerId) {
    throw new Error("INVALID_MANAGER_LINK");
  }
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

export async function linkManagers(createdById: string, peerId: string) {
  const [userAId, userBId] = normalizeManagerPair(createdById, peerId);

  return prisma.managerLink.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, createdById },
    update: {},
  });
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

    const [userAId, userBId] = normalizeManagerPair(creator.id, created.id);
    const existing = await prisma.managerLink.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    if (existing) {
      continue;
    }

    await linkManagers(creator.id, created.id);
    linked += 1;
  }

  return linked;
}
