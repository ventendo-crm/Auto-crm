import { PrismaClient } from "@prisma/client";

// Увеличивайте при изменении prisma/schema.prisma, чтобы dev-сервер подхватил новый клиент.
const PRISMA_SCHEMA_VERSION = 6;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
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
