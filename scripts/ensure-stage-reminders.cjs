/**
 * Создаёт колонки напоминаний на сделках до старта сайта.
 * Запускается из docker/entrypoint.sh. Повторный запуск безопасен.
 */
const { PrismaClient } = require("@prisma/client");

const STATEMENTS = [
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderEnabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderIntervalDays" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderSendTime" TEXT NOT NULL DEFAULT '10:00'`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderTimeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow'`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderNextAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "deals_stageReminderNextAt_idx" ON "deals"("stageReminderNextAt")`,
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'stageReminderEnabled'`,
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Колонка deals.stageReminderEnabled не появилась после ALTER TABLE");
    }
    console.log("[auto-crm] stage reminder columns are present");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[auto-crm] failed to add stage reminder columns:", error);
  process.exit(1);
});
