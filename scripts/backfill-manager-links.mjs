import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "User", action: "CREATE" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, entityId: true, newValue: true },
  });

  let linked = 0;
  let skipped = 0;

  for (const log of logs) {
    const role = (log.newValue as { role?: string } | null)?.role;
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

    const userAId = creator.id < created.id ? creator.id : created.id;
    const userBId = creator.id < created.id ? created.id : creator.id;

    const existing = await prisma.managerLink.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.managerLink.create({
      data: { userAId, userBId, createdById: creator.id },
    });

    linked += 1;
    console.log(`Связаны: ${creator.name} <-> ${created.name}`);
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
