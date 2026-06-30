import { prisma } from "@/lib/prisma";

export async function upsertPushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: params.endpoint },
    create: {
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      userAgent: params.userAgent ?? null,
    },
    update: {
      userId: params.userId,
      p256dh: params.p256dh,
      auth: params.auth,
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const subscription = await prisma.pushSubscription.findFirst({
    where: { userId, endpoint },
    select: { id: true },
  });

  if (!subscription) {
    throw new Error("Not found");
  }

  await prisma.pushSubscription.delete({ where: { id: subscription.id } });
}

export async function removeAllPushSubscriptions(userId: string) {
  const result = await prisma.pushSubscription.deleteMany({ where: { userId } });
  return result.count;
}

export async function countPushSubscriptions(userId: string) {
  return prisma.pushSubscription.count({ where: { userId } });
}
