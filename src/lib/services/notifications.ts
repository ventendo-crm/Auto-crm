import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import {
  formatStageChangeMessage,
  getDefaultTelegramChatIds,
  isTelegramConfigured,
  sendToTelegramChatIds,
} from "@/lib/telegram/bot";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  dealId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type ?? NotificationType.SYSTEM,
      dealId: params.dealId,
    },
  });
}

async function getUserTelegramChatId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  return user?.telegramChatId ?? null;
}

async function dispatchTelegramNotification(params: {
  userIds: string[];
  text: string;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  const chatIds = await Promise.all(params.userIds.map(getUserTelegramChatId));
  const defaultChatIds = getDefaultTelegramChatIds();

  await sendToTelegramChatIds([...chatIds, ...defaultChatIds], params.text);
}

export async function notifyStageChange(params: {
  dealId: string;
  clientName: string;
  vin: string;
  fromStage: string;
  toStage: string;
  manager: { id: string; name: string };
  changedBy: AuthUser;
}) {
  const title = "Сделка переведена";
  const message = [
    `Клиент: ${params.clientName}`,
    `VIN: ${params.vin}`,
    `Этап: ${formatStage(params.fromStage)} → ${formatStage(params.toStage)}`,
    `Менеджер: ${params.manager.name}`,
    `Изменил: ${params.changedBy.name}`,
  ].join("\n");

  const telegramText = formatStageChangeMessage({
    clientName: params.clientName,
    vin: params.vin,
    fromStage: params.fromStage,
    toStage: params.toStage,
    managerName: params.manager.name,
    changedByName: params.changedBy.name,
  });

  const recipientIds = [params.manager.id];
  if (params.changedBy.id !== params.manager.id) {
    recipientIds.push(params.changedBy.id);
  }

  await createNotification({
    userId: params.manager.id,
    dealId: params.dealId,
    title,
    message,
    type: NotificationType.SYSTEM,
  });

  if (params.changedBy.id !== params.manager.id) {
    await createNotification({
      userId: params.changedBy.id,
      dealId: params.dealId,
      title,
      message,
      type: NotificationType.SYSTEM,
    });
  }

  void dispatchTelegramNotification({
    userIds: recipientIds,
    text: telegramText,
  }).catch((error) => {
    console.error("[notifications] telegram dispatch failed:", error);
  });
}

export async function listNotifications(
  userId: string,
  filters: { read?: boolean; page: number; limit: number },
) {
  const where = {
    userId,
    ...(filters.read !== undefined ? { read: filters.read } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        deal: {
          select: { id: true, clientName: true, vin: true, currentStage: true },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total, page: filters.page, limit: filters.limit };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new Error("Not found");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

function formatStage(stage: string): string {
  const labels: Record<string, string> = {
    SEARCH: "Поиск авто",
    INVOICE: "Инвойс",
    PREPARATION: "Подготовка",
    CUSTOMS: "Таможня",
    TRANSPORT: "Транспортировка",
    DELIVERY: "Получение",
  };
  return labels[stage] ?? stage;
}
