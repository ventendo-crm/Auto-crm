/**
 * Создаёт колонку уведомления по задачам до старта сайта.
 * Запускается из docker/entrypoint.sh. Повторный запуск безопасен.
 */
const { PrismaClient } = require("@prisma/client");

const STATEMENTS = [
  `ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "reminders_completed_notifiedAt_idx" ON "reminders"("completed", "notifiedAt")`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reminders' AND column_name = 'notifiedAt'`,
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Колонка reminders.notifiedAt не появилась после ALTER TABLE");
    }
    console.log("[auto-crm] task reminder notify column is present");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[auto-crm] failed to add task reminder notify column:", error);
  process.exit(1);
});
