import { prisma } from "@/lib/prisma";

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
