import { PrismaClient } from "@prisma/client";

// Увеличивайте при изменении prisma/schema.prisma, чтобы dev-сервер подхватил новый клиент.
const PRISMA_SCHEMA_VERSION = 13;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

const STAGE_REMINDER_COLUMN_SQL = [
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderEnabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderIntervalDays" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderSendTime" TEXT NOT NULL DEFAULT '10:00'`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderTimeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow'`,
  `ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stageReminderNextAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "deals_stageReminderNextAt_idx" ON "deals"("stageReminderNextAt")`,
];

function ensureStageReminderColumns(client: PrismaClient): Promise<void> {
  const state = globalForPrisma as typeof globalForPrisma & {
    stageReminderColumns?: Promise<void>;
  };
  if (!state.stageReminderColumns) {
    state.stageReminderColumns = (async () => {
      for (const sql of STAGE_REMINDER_COLUMN_SQL) {
        await client.$executeRawUnsafe(sql);
      }
    })().catch((error) => {
      state.stageReminderColumns = undefined;
      console.error("[auto-crm] failed to add stage reminder columns:", error);
      throw error;
    });
  }
  return state.stageReminderColumns;
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Любой запрос к сделке сначала добавляет колонки, если на сервере их ещё нет.
  return base.$extends({
    query: {
      deal: {
        async $allOperations({ args, query }) {
          await ensureStageReminderColumns(base);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;
  const cachedVersion = globalForPrisma.prismaSchemaVersion;

  if (cached && cachedVersion !== PRISMA_SCHEMA_VERSION) {
    void cached.$disconnect();
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaVersion = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
