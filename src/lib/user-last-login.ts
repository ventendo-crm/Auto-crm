import { prisma } from "@/lib/prisma";

let ensurePromise: Promise<void> | null = null;

/** Adds users.lastLoginAt if missing (idempotent). Safe to call often. */
export function ensureUserLastLoginAtColumn(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = prisma
      .$executeRawUnsafe(
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`,
      )
      .then(() => undefined)
      .catch((error) => {
        ensurePromise = null;
        console.warn("[auto-crm] ensure lastLoginAt column failed:", error);
      });
  }
  return ensurePromise;
}

/** Updates lastLoginAt; never throws — login must not depend on this column. */
export async function recordUserLastLogin(userId: string): Promise<Date | null> {
  const lastLoginAt = new Date();
  await ensureUserLastLoginAtColumn();
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt },
    });
    return lastLoginAt;
  } catch (error) {
    console.warn("[auto-crm] lastLoginAt update skipped:", error);
    return null;
  }
}
