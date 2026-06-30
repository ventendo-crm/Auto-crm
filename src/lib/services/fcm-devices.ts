import { prisma } from "@/lib/prisma";

export async function upsertFcmDevice(params: {
  userId: string;
  token: string;
  label?: string | null;
}) {
  return prisma.fcmDevice.upsert({
    where: { token: params.token },
    create: {
      userId: params.userId,
      token: params.token,
      label: params.label ?? null,
    },
    update: {
      userId: params.userId,
      label: params.label ?? null,
    },
  });
}

export async function removeFcmDevice(userId: string, token: string) {
  const device = await prisma.fcmDevice.findFirst({
    where: { userId, token },
    select: { id: true },
  });

  if (!device) {
    throw new Error("Not found");
  }

  await prisma.fcmDevice.delete({ where: { id: device.id } });
}
