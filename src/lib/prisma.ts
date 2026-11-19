import "server-only";
import { PrismaClient } from "@prisma/client";

// Увеличивайте при изменении prisma/schema.prisma, чтобы dev-сервер подхватил новый клиент.
const PRISMA_SCHEMA_VERSION = 16;

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

const TASK_REMINDER_NOTIFY_SQL = [
  `ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "reminders_completed_notifiedAt_idx" ON "reminders"("completed", "notifiedAt")`,
];

const MAX_BOT_COLUMN_SQL = [
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxBotToken" TEXT`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxBotId" TEXT`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxBotUsername" TEXT`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxBotName" TEXT`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxWebhookSecret" TEXT`,
  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "maxConnectedAt" TIMESTAMP(3)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "maxUserId" TEXT`,
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

function ensureOfferEquipmentGroupsColumn(client: PrismaClient): Promise<void> {
  const state = globalForPrisma as typeof globalForPrisma & {
    offerEquipmentGroupsColumn?: Promise<void>;
  };
  if (!state.offerEquipmentGroupsColumn) {
    state.offerEquipmentGroupsColumn = client
      .$executeRawUnsafe(
        `ALTER TABLE "company_workspace_settings" ADD COLUMN IF NOT EXISTS "offerEquipmentGroups" JSONB NOT NULL DEFAULT '[]'::jsonb`,
      )
      .then(() => undefined)
      .catch((error) => {
        state.offerEquipmentGroupsColumn = undefined;
        console.error("[auto-crm] failed to add offer equipment groups column:", error);
        throw error;
      });
  }
  return state.offerEquipmentGroupsColumn;
}

function ensureMaxBotColumns(client: PrismaClient): Promise<void> {
  const state = globalForPrisma as typeof globalForPrisma & {
    maxBotColumns?: Promise<void>;
  };
  if (!state.maxBotColumns) {
    state.maxBotColumns = (async () => {
      for (const sql of MAX_BOT_COLUMN_SQL) {
        await client.$executeRawUnsafe(sql);
      }
    })().catch((error) => {
      state.maxBotColumns = undefined;
      console.error("[auto-crm] failed to add MAX bot columns:", error);
      throw error;
    });
  }
  return state.maxBotColumns;
}

function ensureTaskReminderNotifyColumn(client: PrismaClient): Promise<void> {
  const state = globalForPrisma as typeof globalForPrisma & {
    taskReminderNotifyColumn?: Promise<void>;
  };
  if (!state.taskReminderNotifyColumn) {
    state.taskReminderNotifyColumn = (async () => {
      for (const sql of TASK_REMINDER_NOTIFY_SQL) {
        await client.$executeRawUnsafe(sql);
      }
    })().catch((error) => {
      state.taskReminderNotifyColumn = undefined;
      console.error("[auto-crm] failed to add task reminder notify column:", error);
      throw error;
    });
  }
  return state.taskReminderNotifyColumn;
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Любой запрос к сделке/задаче сначала добавляет колонки, если на сервере их ещё нет.
  return base.$extends({
    query: {
      deal: {
        async $allOperations({ args, query }) {
          await ensureStageReminderColumns(base);
          return query(args);
        },
      },
      reminder: {
        async $allOperations({ args, query }) {
          await ensureTaskReminderNotifyColumn(base);
          return query(args);
        },
      },
      companyWorkspaceSettings: {
        async $allOperations({ args, query }) {
          await ensureOfferEquipmentGroupsColumn(base);
          return query(args);
        },
      },
      company: {
        async $allOperations({ args, query }) {
          await ensureMaxBotColumns(base);
          return query(args);
        },
      },
      user: {
        async $allOperations({ args, query }) {
          await ensureMaxBotColumns(base);
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
