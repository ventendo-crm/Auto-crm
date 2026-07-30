import { DealStageType, DocumentType, NotificationType } from "@prisma/client";
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
import { getClientStageMessage } from "@/lib/services/client-stage-messages";
import {
  formatClientStageNotificationMessage,
  formatCommentMessage,
  formatStageChangeMessage,
  getCompanyTelegramConfig,
  getDefaultTelegramChatIds,
  isCompanyTelegramConfigured,
  sendCompanyTelegramDocument,
  sendCompanyTelegramMessages,
} from "@/lib/telegram/bot";
import { displayStoredFileName } from "@/lib/storage/local-uploads";

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

async function resolveDealCompanyId(dealId: string): Promise<string | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { companyId: true },
  });
  return deal?.companyId ?? null;
}

async function dispatchTelegramToUsers(params: {
  companyId: string;
  userIds: string[];
  text: string;
  includeDefaultChatIds?: boolean;
}): Promise<void> {
  const config = await getCompanyTelegramConfig(params.companyId);
  if (!isCompanyTelegramConfigured(config) || !config.token) {
    console.warn("[notifications] Telegram skipped: company bot token is not set", params.companyId);
    return;
  }

  const chatIds = await Promise.all(params.userIds.map(getUserTelegramChatId));
  const defaultChatIds =
    params.includeDefaultChatIds === false
      ? []
      : getDefaultTelegramChatIds(config.defaultChatId);
  const uniqueChatIds = [
    ...new Set([...chatIds.filter((id): id is string => Boolean(id?.trim())), ...defaultChatIds]),
  ];

  if (uniqueChatIds.length === 0) {
    console.warn(
      "[notifications] Telegram skipped: no chat IDs for users",
      params.userIds,
      "and company default chat is empty",
    );
    return;
  }

  const results = await sendCompanyTelegramMessages({
    token: config.token,
    chatIds: uniqueChatIds,
    text: params.text,
  });
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
  managers: Array<{ id: string; name: string }>;
  changedBy: AuthUser;
}) {
  const companyId = (await resolveDealCompanyId(params.dealId)) ?? params.changedBy.companyId;
  const title = "Сделка переведена";
  const managerLabel =
    params.managers.length > 0
      ? params.managers.map((manager) => manager.name).join(", ")
      : "не назначен";
  const message = [
    `Клиент: ${params.clientName}`,
    `VIN: ${params.vin}`,
    `Этап: ${formatStage(params.fromStage)} → ${formatStage(params.toStage)}`,
    `Менеджер: ${managerLabel}`,
    `Изменил: ${params.changedBy.name}`,
  ].join("\n");

  const telegramText = await formatStageChangeMessage({
    companyId,
    clientName: params.clientName,
    vin: params.vin,
    fromStage: params.fromStage,
    toStage: params.toStage,
    managerName: managerLabel,
    changedByName: params.changedBy.name,
  });

  const recipientIds = new Set<string>();
  for (const manager of params.managers) {
    recipientIds.add(manager.id);
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
    companyId,
    userIds: [...recipientIds],
    text: telegramText,
  });

  await notifyClientStageChange({
    companyId,
    dealId: params.dealId,
    clientUserId: params.clientUserId,
    toStage: params.toStage,
    carBrand: params.carBrand,
    carModel: params.carModel,
    vin: params.vin,
  });
}

async function notifyClientStageChange(params: {
  companyId: string;
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

  const body = await getClientStageMessage(params.companyId, params.toStage);
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

  const telegramText = await formatClientStageNotificationMessage({
    companyId: params.companyId,
    stageLabel,
    body,
    carLabel,
    vin: params.vin,
  });

  await dispatchTelegramToUsers({
    companyId: params.companyId,
    userIds: [params.clientUserId],
    text: telegramText,
    includeDefaultChatIds: false,
  });

  if (params.toStage === DealStageType.INVOICE) {
    await sendClientInvoiceDocumentIfReady({
      companyId: params.companyId,
      dealId: params.dealId,
      clientUserId: params.clientUserId,
      vin: params.vin,
    });
  }

  const email = await formatClientStageEmail({
    companyId: params.companyId,
    stageLabel,
    body,
    carLabel,
    vin: params.vin,
  });

  void sendEmailToClientUser(params.clientUserId, email);
}

/** Отправляет файл INVOICE клиенту в Telegram, если документ загружен и Chat ID привязан. */
export async function sendClientInvoiceDocumentIfReady(params: {
  companyId: string;
  dealId: string;
  clientUserId: string;
  vin?: string | null;
}): Promise<boolean> {
  const [client, invoice] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.clientUserId },
      select: { telegramChatId: true, name: true },
    }),
    prisma.document.findUnique({
      where: {
        dealId_type: { dealId: params.dealId, type: DocumentType.INVOICE },
      },
      select: { fileUrl: true },
    }),
  ]);

  if (!client?.telegramChatId?.trim()) {
    console.warn(
      "[notifications] Invoice Telegram skipped: client has no telegramChatId",
      params.clientUserId,
    );
    return false;
  }

  if (!invoice?.fileUrl) {
    console.warn(
      "[notifications] Invoice Telegram skipped: INVOICE file missing for deal",
      params.dealId,
    );
    return false;
  }

  const fileName = displayStoredFileName(invoice.fileUrl.split("/").pop() || "invoice.pdf");
  const caption = [
    "📄 <b>Инвойс по вашей сделке</b>",
    params.vin?.trim() ? `VIN: <code>${params.vin.trim()}</code>` : "",
    "",
    "Документ во вложении.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendCompanyTelegramDocument({
    companyId: params.companyId,
    chatId: client.telegramChatId.trim(),
    fileUrl: invoice.fileUrl,
    caption,
    displayName: fileName,
  });

  if (!result.ok) {
    console.error(
      "[notifications] Invoice Telegram document failed:",
      result.chatId,
      result.error,
    );
    return false;
  }

  return true;
}

/** Вызывается после загрузки INVOICE, если сделка уже на этапе Инвойс. */
export async function notifyClientInvoiceUploaded(params: {
  dealId: string;
  companyId: string;
}): Promise<void> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, companyId: params.companyId },
    select: {
      currentStage: true,
      clientUserId: true,
      vin: true,
    },
  });

  if (!deal?.clientUserId || deal.currentStage !== DealStageType.INVOICE) {
    return;
  }

  await sendClientInvoiceDocumentIfReady({
    companyId: params.companyId,
    dealId: params.dealId,
    clientUserId: deal.clientUserId,
    vin: deal.vin,
  });
}

export async function notifyCommentAdded(params: {
  dealId: string;
  deal: {
    companyId?: string;
    clientName: string;
    vin: string;
    managerId: string | null;
    managerIds?: string[];
    clientUserId: string | null;
  };
  author: AuthUser;
  commentText: string;
}) {
  const companyId =
    params.deal.companyId ??
    (await resolveDealCompanyId(params.dealId)) ??
    params.author.companyId;

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

  const telegramText = await formatCommentMessage({
    companyId,
    clientName: params.deal.clientName,
    vin: params.deal.vin,
    authorName: params.author.name,
    authorRole: authorRoleLabel,
    text: params.commentText,
  });

  const recipientIds = new Set<string>();

  if (params.author.role === ROLES.CLIENT) {
    const managerIds =
      params.deal.managerIds && params.deal.managerIds.length > 0
        ? params.deal.managerIds
        : params.deal.managerId
          ? [params.deal.managerId]
          : [];

    if (managerIds.length > 0) {
      for (const managerId of managerIds) {
        recipientIds.add(managerId);
      }
    } else {
      const admins = await prisma.user.findMany({
        where: { companyId, role: { name: ROLES.ADMIN } },
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
      companyId,
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
      companyId,
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
