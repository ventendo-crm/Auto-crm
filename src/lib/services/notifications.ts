import { DealStageType, DocumentType, MediaType, NotificationType } from "@prisma/client";
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
  formatCarCarrierTrackingPointMessage,
  formatClientStageNotificationMessage,
  formatCommentMessage,
  formatStageChangeMessage,
  getCompanyTelegramConfig,
  getDefaultTelegramChatIds,
  isCompanyTelegramConfigured,
  sendCompanyTelegramDocument,
  sendCompanyTelegramMedia,
  sendCompanyTelegramMessages,
  type CompanyTelegramMediaItem,
} from "@/lib/telegram/bot";
import { displayStoredFileName } from "@/lib/storage/local-uploads";
import { formatCurrency } from "@/lib/utils";

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
  const caption = [
    "📄 <b>Инвойс по вашей сделке</b>",
    params.vin?.trim() ? `VIN: <code>${params.vin.trim()}</code>` : "",
    "",
    "Документ во вложении.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendClientDealDocument({
    companyId: params.companyId,
    dealId: params.dealId,
    clientUserId: params.clientUserId,
    type: DocumentType.INVOICE,
    caption,
    defaultFileName: "invoice.pdf",
  });
}

async function sendClientDealDocument(params: {
  companyId: string;
  dealId: string;
  clientUserId: string;
  type: DocumentType;
  caption: string;
  defaultFileName: string;
}): Promise<boolean> {
  const [client, document] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.clientUserId },
      select: { telegramChatId: true },
    }),
    prisma.document.findUnique({
      where: {
        dealId_type: { dealId: params.dealId, type: params.type },
      },
      select: { fileUrl: true },
    }),
  ]);

  if (!client?.telegramChatId?.trim()) {
    console.warn(
      "[notifications] Document Telegram skipped: client has no telegramChatId",
      params.type,
      params.clientUserId,
    );
    return false;
  }

  if (!document?.fileUrl) {
    console.warn(
      "[notifications] Document Telegram skipped: file missing",
      params.type,
      params.dealId,
    );
    return false;
  }

  const fileName = displayStoredFileName(
    document.fileUrl.split("/").pop() || params.defaultFileName,
  );

  const result = await sendCompanyTelegramDocument({
    companyId: params.companyId,
    chatId: client.telegramChatId.trim(),
    fileUrl: document.fileUrl,
    caption: params.caption,
    displayName: fileName,
  });

  if (!result.ok) {
    console.error(
      "[notifications] Document Telegram failed:",
      params.type,
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

/** Уведомляет клиента о загруженном ЭПТС и отправляет файл в Telegram. */
export async function notifyClientEptsUploaded(params: {
  dealId: string;
  companyId: string;
}): Promise<void> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, companyId: params.companyId },
    select: { clientUserId: true },
  });

  if (!deal?.clientUserId) {
    return;
  }

  await createNotification({
    userId: deal.clientUserId,
    dealId: params.dealId,
    title: "ЭПТС загружен",
    message: "Документ ЭПТС доступен в личном кабинете.",
    type: NotificationType.SYSTEM,
  });

  await sendClientDealDocument({
    companyId: params.companyId,
    dealId: params.dealId,
    clientUserId: deal.clientUserId,
    type: DocumentType.EPTS,
    caption: ["📄 <b>ЭПТС по вашей сделке</b>", "", "Документ во вложении."].join("\n"),
    defaultFileName: "epts.pdf",
  });
}

async function resolveClientTelegramTarget(dealId: string): Promise<{
  companyId: string;
  clientUserId: string;
  chatId: string;
} | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      companyId: true,
      clientUserId: true,
      clientUser: { select: { telegramChatId: true } },
    },
  });

  const chatId = deal?.clientUser?.telegramChatId?.trim();
  if (!deal?.clientUserId || !chatId) {
    return null;
  }

  return {
    companyId: deal.companyId,
    clientUserId: deal.clientUserId,
    chatId,
  };
}

async function notifyClientWithMedia(params: {
  dealId: string;
  title: string;
  message: string;
  caption: string;
  media: CompanyTelegramMediaItem[];
  /** Отдельное текстовое сообщение перед медиа (описание, цена и т.п.). */
  telegramTextBeforeMedia?: string;
}): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: params.dealId },
    select: { companyId: true, clientUserId: true },
  });

  if (!deal?.clientUserId) {
    return;
  }

  await createNotification({
    userId: deal.clientUserId,
    dealId: params.dealId,
    title: params.title,
    message: params.message,
    type: NotificationType.SYSTEM,
  });

  const target = await resolveClientTelegramTarget(params.dealId);
  if (!target) {
    console.warn(
      "[notifications] Media Telegram skipped: no telegramChatId",
      params.dealId,
    );
    return;
  }

  if (params.media.length === 0) {
    await dispatchTelegramToUsers({
      companyId: target.companyId,
      userIds: [target.clientUserId],
      text: params.telegramTextBeforeMedia ?? params.caption,
      includeDefaultChatIds: false,
    });
    return;
  }

  if (params.telegramTextBeforeMedia?.trim()) {
    await dispatchTelegramToUsers({
      companyId: target.companyId,
      userIds: [target.clientUserId],
      text: params.telegramTextBeforeMedia,
      includeDefaultChatIds: false,
    });
  }

  const result = await sendCompanyTelegramMedia({
    companyId: target.companyId,
    chatId: target.chatId,
    items: params.media,
    caption: params.telegramTextBeforeMedia ? undefined : params.caption,
  });

  if (!result.ok) {
    console.error(
      "[notifications] Media Telegram failed:",
      result.chatId,
      result.error,
    );
    await dispatchTelegramToUsers({
      companyId: target.companyId,
      userIds: [target.clientUserId],
      text: params.telegramTextBeforeMedia ?? params.caption,
      includeDefaultChatIds: false,
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toTelegramMediaItems(
  media: Array<{ fileKey: string; fileName: string; type: MediaType }>,
): CompanyTelegramMediaItem[] {
  return media
    .filter((item) => item.fileKey?.trim() && item.fileName?.trim())
    .map((item) => ({
      fileUrl: item.fileKey,
      fileName: item.fileName,
      type: item.type,
    }));
}

function buildSearchProcessVariantNotification(params: {
  variantNumber: number;
  description: string;
  totalWithCar: number | null;
  isUpdate: boolean;
}): { title: string; message: string; telegramText: string } {
  const description = params.description.trim();
  const title = params.isUpdate
    ? `Обновлён вариант автомобиля №${params.variantNumber}`
    : `Новый вариант автомобиля №${params.variantNumber}`;

  const messageParts = [
    description || (params.isUpdate ? "Обновлены данные варианта в поиске." : "Добавлен вариант в поиске."),
    params.totalWithCar != null && params.totalWithCar > 0
      ? `Итого: ${formatCurrency(params.totalWithCar)}`
      : null,
  ].filter(Boolean);

  const telegramLines = [
    params.isUpdate ? "🔄 <b>Обновление варианта автомобиля</b>" : "🚗 <b>Новый вариант автомобиля</b>",
    "",
    `<b>Вариант №${params.variantNumber}</b>`,
  ];

  if (description) {
    telegramLines.push("", escapeHtml(description));
  }

  if (params.totalWithCar != null && params.totalWithCar > 0) {
    telegramLines.push("", `<b>Итого:</b> ${escapeHtml(formatCurrency(params.totalWithCar))}`);
  }

  return {
    title,
    message: messageParts.join("\n"),
    telegramText: telegramLines.join("\n").trim(),
  };
}

/** Публикация или обновление варианта в «Процессе поиска» — Telegram клиенту. */
export async function notifyClientSearchProcessVariantPublished(params: {
  dealId: string;
  entryId: string;
  variantNumber: number;
  description: string;
  totalWithCar: number | null;
  media: Array<{ fileKey: string; fileName: string; type: MediaType }>;
  isUpdate: boolean;
}): Promise<void> {
  const items = toTelegramMediaItems(params.media);
  if (items.length === 0) {
    return;
  }

  const { title, message, telegramText } = buildSearchProcessVariantNotification({
    variantNumber: params.variantNumber,
    description: params.description,
    totalWithCar: params.totalWithCar,
    isUpdate: params.isUpdate,
  });

  await notifyClientWithMedia({
    dealId: params.dealId,
    title,
    message,
    caption: telegramText,
    telegramTextBeforeMedia: telegramText,
    media: items,
  });
}

/** Фото/видео к точке маршрута автовоза. */
export async function notifyClientTrackingPointMediaUploaded(params: {
  dealId: string;
  pointId: string;
  media: Array<{ fileKey: string; fileName: string; type: MediaType }>;
}): Promise<void> {
  const items = toTelegramMediaItems(params.media);
  if (items.length === 0) {
    return;
  }

  const point = await prisma.carCarrierTrackingPoint.findFirst({
    where: { id: params.pointId, dealId: params.dealId },
    select: { title: true, description: true },
  });

  if (!point) {
    return;
  }

  const pointTitle = point.title.trim() || "Точка маршрута";
  const pointDescription = point.description.trim();
  const title = "Фото с маршрута автовоза";
  const message = [pointTitle, ...(pointDescription ? [pointDescription] : [])].join("\n");
  const caption = [
    "🚚 <b>Фото с маршрута автовоза</b>",
    "",
    `<b>${escapeHtml(pointTitle)}</b>`,
    pointDescription ? escapeHtml(pointDescription) : "",
  ]
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0))
    .join("\n")
    .trim();

  await notifyClientWithMedia({
    dealId: params.dealId,
    title,
    message,
    caption,
    media: items,
  });
}

/** Новые фото/видео в галерее сделки. */
export async function notifyClientGalleryMediaUploaded(params: {
  dealId: string;
  media: Array<{ fileKey: string; fileName: string; type: MediaType }>;
}): Promise<void> {
  const items = toTelegramMediaItems(params.media);
  if (items.length === 0) {
    return;
  }

  const hasVideo = items.some((item) => item.type === MediaType.VIDEO);
  const title = hasVideo ? "Новые медиа по сделке" : "Новые фото по сделке";
  const message = "Материалы доступны в личном кабинете.";
  const caption = [
    hasVideo ? "🖼 <b>Новые медиа по вашей сделке</b>" : "🖼 <b>Новые фото по вашей сделке</b>",
    "",
    "Смотрите вложения. Подробности — в личном кабинете.",
  ].join("\n");

  await notifyClientWithMedia({
    dealId: params.dealId,
    title,
    message,
    caption,
    media: items,
  });
}

/** Уведомляет клиента о новой точке в «Отслеживание автовоза». */
export async function notifyClientCarCarrierTrackingPointAdded(params: {
  dealId: string;
  pointTitle?: string | null;
  pointDescription?: string | null;
  recordedAt?: Date | string | null;
}): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: params.dealId },
    select: {
      companyId: true,
      clientUserId: true,
    },
  });

  if (!deal?.clientUserId) {
    return;
  }

  const pointTitle = params.pointTitle?.trim() || "Новая точка маршрута";
  const pointDescription = params.pointDescription?.trim() || "";

  const title = "Обновление маршрута автовоза";
  const message = [pointTitle, ...(pointDescription ? [pointDescription] : [])].join("\n");

  await createNotification({
    userId: deal.clientUserId,
    dealId: params.dealId,
    title,
    message,
    type: NotificationType.SYSTEM,
  });

  const telegramText = await formatCarCarrierTrackingPointMessage({
    companyId: deal.companyId,
    pointTitle,
    pointDescription,
    recordedAt: params.recordedAt,
  });

  await dispatchTelegramToUsers({
    companyId: deal.companyId,
    userIds: [deal.clientUserId],
    text: telegramText,
    includeDefaultChatIds: false,
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
