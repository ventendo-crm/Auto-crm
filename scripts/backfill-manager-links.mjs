import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePair(userId, peerId) {
  if (userId === peerId) {
    throw new Error("INVALID_MANAGER_LINK");
  }
  return userId < peerId ? [userId, peerId] : [peerId, userId];
}

async function getPeerIds(managerId) {
  const links = await prisma.managerLink.findMany({
    where: {
      OR: [{ userAId: managerId }, { userBId: managerId }],
    },
    select: { userAId: true, userBId: true },
  });

  return links.map((link) => (link.userAId === managerId ? link.userBId : link.userAId));
}

async function getVisibleManagerIds(managerId) {
  const peers = await getPeerIds(managerId);
  return [managerId, ...peers];
}

async function upsertLink(userId, peerId, createdById) {
  const [userAId, userBId] = normalizePair(userId, peerId);
  const existing = await prisma.managerLink.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });

  if (existing) {
    return false;
  }

  await prisma.managerLink.create({
    data: { userAId, userBId, createdById },
  });

  return true;
}

async function linkManagersNetwork(createdById, peerId) {
  const networkIds = await getVisibleManagerIds(createdById);
  let linked = 0;

  for (const memberId of networkIds) {
    if (memberId === peerId) {
      continue;
    }
    if (await upsertLink(memberId, peerId, createdById)) {
      linked += 1;
    }
  }

  return linked;
}

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "User", action: "CREATE" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, entityId: true, newValue: true },
  });

  let linked = 0;
  let skipped = 0;

  for (const log of logs) {
    const role = log.newValue?.role;
    if (role !== "MANAGER") {
      skipped += 1;
      continue;
    }

    const [creator, created] = await Promise.all([
      prisma.user.findUnique({
        where: { id: log.userId },
        select: { id: true, name: true, role: { select: { name: true } } },
      }),
      prisma.user.findUnique({
        where: { id: log.entityId },
        select: { id: true, name: true, role: { select: { name: true } } },
      }),
    ]);

    if (!creator || !created) {
      skipped += 1;
      continue;
    }

    if (creator.role.name !== "MANAGER" || created.role.name !== "MANAGER") {
      skipped += 1;
      continue;
    }

    if (creator.id === created.id) {
      skipped += 1;
      continue;
    }

    const createdLinks = await linkManagersNetwork(creator.id, created.id);
    if (createdLinks > 0) {
      linked += createdLinks;
      console.log(`Связаны: ${creator.name} ↔ сеть ↔ ${created.name} (+${createdLinks})`);
    } else {
      skipped += 1;
    }
  }

  const total = await prisma.managerLink.count();
  console.log(`\nНовых связей: ${linked}, пропущено записей: ${skipped}, всего связей в БД: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
