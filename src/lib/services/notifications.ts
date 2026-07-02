import { DealStageType, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailToClientUser } from "@/lib/email/send";
import {
  formatClientCommentEmail,
  formatClientStageEmail,
} from "@/lib/email/templates";
import { dispatchPushToUser } from "@/lib/push/dispatch";
import { AuthUser, ROLES } from "@/lib/permissions";
import {
  CLIENT_STAGE_NOTIFICATIONS,
  COMMENT_AUTHOR_ROLE_LABELS,
  STAGE_LABELS,
} from "@/lib/constants";
import {
  formatClientStageNotificationMessage,
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
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type ?? NotificationType.SYSTEM,
      dealId: params.dealId,
    },
  });

  void dispatchPushToUser(params.userId, {
    title: params.title,
    body: params.message,
    url: params.dealId ? `/deals/${params.dealId}` : "/settings",
  });

  return notification;
}

async function getUserTelegramChatId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });
  return user?.telegramChatId ?? null;
}

async function dispatchTelegramToUsers(params: {
  userIds: string[];
  text: string;
  includeDefaultChatIds?: boolean;
}): Promise<void> {
  if (!isTelegramConfigured()) {
    console.warn("[notifications] Telegram skipped: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const chatIds = await Promise.all(params.userIds.map(getUserTelegramChatId));
  const defaultChatIds = params.includeDefaultChatIds === false ? [] : getDefaultTelegramChatIds();
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
  carBrand?: string | null;
  carModel?: string | null;
  clientUserId?: string | null;
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

  await dispatchTelegramToUsers({
    userIds: [...recipientIds],
    text: telegramText,
  });

  await notifyClientStageChange({
    dealId: params.dealId,
    clientUserId: params.clientUserId,
    toStage: params.toStage,
    carBrand: params.carBrand,
    carModel: params.carModel,
    vin: params.vin,
  });
}

async function notifyClientStageChange(params: {
  dealId: string;
  clientUserId?: string | null;
  toStage: string;
  carBrand?: string | null;
  carModel?: string | null;
  vin: string;
}) {
  if (!params.clientUserId) {
    return;
  }

  if (!isDealStageType(params.toStage)) {
    return;
  }

  const body = CLIENT_STAGE_NOTIFICATIONS[params.toStage];
  const stageLabel = STAGE_LABELS[params.toStage];
  const carLabel = [params.carBrand, params.carModel].filter(Boolean).join(" ").trim() || null;
  const title = `Этап: ${stageLabel}`;

  const message = [
    body,
    ...(carLabel ? ["", `Автомобиль: ${carLabel}`] : []),
    ...(params.vin?.trim() ? [`VIN: ${params.vin.trim()}`] : []),
  ].join("\n");

  await createNotification({
    userId: params.clientUserId,
    dealId: params.dealId,
    title,
    message,
    type: NotificationType.SYSTEM,
  });

  const telegramText = formatClientStageNotificationMessage({
    stageLabel,
    body,
    carLabel,
    vin: params.vin,
  });

  await dispatchTelegramToUsers({
    userIds: [params.clientUserId],
    text: telegramText,
    includeDefaultChatIds: false,
  });

  const email = await formatClientStageEmail({
    stageLabel,
    body,
    carLabel,
    vin: params.vin,
  });

  void sendEmailToClientUser(params.clientUserId, email);
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
    await dispatchTelegramToUsers({
      userIds: [...recipientIds],
      text: telegramText,
    });
  }

  if (
    params.author.role !== ROLES.CLIENT &&
    params.deal.clientUserId &&
    recipientIds.has(params.deal.clientUserId)
  ) {
    const email = await formatClientCommentEmail({
      clientName: params.deal.clientName,
      vin: params.deal.vin,
      authorName: params.author.name,
      authorRole: authorRoleLabel,
      text: params.commentText,
    });

    void sendEmailToClientUser(params.deal.clientUserId, email);
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
  if (isDealStageType(stage)) {
    return STAGE_LABELS[stage];
  }
  return stage;
}

function isDealStageType(value: string): value is DealStageType {
  return Object.prototype.hasOwnProperty.call(CLIENT_STAGE_NOTIFICATIONS, value);
}
