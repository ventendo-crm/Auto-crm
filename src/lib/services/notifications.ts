import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES } from "@/lib/permissions";
import { COMMENT_AUTHOR_ROLE_LABELS } from "@/lib/constants";
import {
  formatCommentMessage,
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
  if (!isTelegramConfigured()) {
    console.warn("[notifications] Telegram skipped: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const chatIds = await Promise.all(params.userIds.map(getUserTelegramChatId));
  const defaultChatIds = getDefaultTelegramChatIds();
  const uniqueChatIds = [
    ...new Set([...chatIds.filter((id): id is string => Boolean(id?.trim())), ...defaultChatIds]),
  ];

  if (uniqueChatIds.length === 0) {
    console.warn(
      "[notifications] Telegram skipped: no chat IDs for users",
      params.userIds,
      "and TELEGRAM_CHAT_ID is empty",
    );
    return;
  }

  const results = await sendToTelegramChatIds(uniqueChatIds, params.text);
  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0) {
    console.error(
      "[notifications] Telegram delivery failed:",
      failed.map((result) => `${result.chatId}: ${result.error}`).join("; "),
    );
  }
}

export async function notifyStageChange(params: {
  dealId: string;
  clientName: string;
  vin: string;
  fromStage: string;
  toStage: string;
  manager: { id: string; name: string } | null;
  changedBy: AuthUser;
}) {
  const title = "Сделка переведена";
  const managerLabel = params.manager?.name ?? "не назначен";
  const message = [
    `Клиент: ${params.clientName}`,
    `VIN: ${params.vin}`,
    `Этап: ${formatStage(params.fromStage)} → ${formatStage(params.toStage)}`,
    `Менеджер: ${managerLabel}`,
    `Изменил: ${params.changedBy.name}`,
  ].join("\n");

  const telegramText = formatStageChangeMessage({
    clientName: params.clientName,
    vin: params.vin,
    fromStage: params.fromStage,
    toStage: params.toStage,
    managerName: managerLabel,
    changedByName: params.changedBy.name,
  });

  const recipientIds = new Set<string>();
  if (params.manager) {
    recipientIds.add(params.manager.id);
  }
  recipientIds.add(params.changedBy.id);

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      dealId: params.dealId,
      title,
      message,
      type: NotificationType.SYSTEM,
    });
  }

  await dispatchTelegramNotification({
    userIds: [...recipientIds],
    text: telegramText,
  });
}

export async function notifyCommentAdded(params: {
  dealId: string;
  deal: {
    clientName: string;
    vin: string;
    managerId: string | null;
    clientUserId: string | null;
  };
  author: AuthUser;
  commentText: string;
}) {
  const title = "Новый комментарий";
  const preview =
    params.commentText.length > 120
      ? `${params.commentText.slice(0, 120).trim()}…`
      : params.commentText;
  const message = [
    `Клиент: ${params.deal.clientName}`,
    `VIN: ${params.deal.vin}`,
    `Автор: ${params.author.name}`,
    "",
    preview,
  ].join("\n");

  const authorRoleLabel =
    COMMENT_AUTHOR_ROLE_LABELS[params.author.role] ?? params.author.role;

  const telegramText = formatCommentMessage({
    clientName: params.deal.clientName,
    vin: params.deal.vin,
    authorName: params.author.name,
    authorRole: authorRoleLabel,
    text: params.commentText,
  });

  const recipientIds = new Set<string>();

  if (params.author.role === ROLES.CLIENT) {
    if (params.deal.managerId) {
      recipientIds.add(params.deal.managerId);
    } else {
      const admins = await prisma.user.findMany({
        where: { role: { name: ROLES.ADMIN } },
        select: { id: true },
      });
      for (const admin of admins) {
        recipientIds.add(admin.id);
      }
    }
  } else if (params.deal.clientUserId) {
    recipientIds.add(params.deal.clientUserId);
  }

  recipientIds.delete(params.author.id);

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      dealId: params.dealId,
      title,
      message,
      type: NotificationType.SYSTEM,
    });
  }

  if (recipientIds.size > 0) {
    await dispatchTelegramNotification({
      userIds: [...recipientIds],
      text: telegramText,
    });
  }
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
    LEADS: "Лиды",
    SEARCH: "Поиск авто",
    INVOICE: "Инвойс",
    PREPARATION: "Подготовка",
    CUSTOMS: "Таможня",
    TRANSPORT: "Транспортировка",
    DELIVERY: "Получение",
  };
  return labels[stage] ?? stage;
}
