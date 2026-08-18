import { MediaType } from "@prisma/client";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { callTelegramApi, callTelegramApiForm } from "@/lib/telegram/http";
import { formatTestNotificationMessage } from "@/lib/telegram/templates";
import { prisma } from "@/lib/prisma";
import {
  displayStoredFileName,
  guessUploadContentType,
  isLocalUploadUrl,
  localUploadFilePath,
} from "@/lib/storage/local-uploads";
import { openStoredMediaFile } from "@/lib/storage/media-storage";

export {
  formatCarCarrierTrackingPointMessage,
  formatCommentMessage,
  formatClientStageNotificationMessage,
  formatStageChangeMessage,
  formatStageLabel,
  formatTestNotificationMessage,
} from "@/lib/telegram/templates";

export interface TelegramSendResult {
  ok: boolean;
  chatId: string;
  error?: string;
}

export interface CompanyTelegramMediaItem {
  fileUrl: string;
  fileName: string;
  type: MediaType;
}

export interface CompanyTelegramConfig {
  companyId: string;
  token: string | null;
  defaultChatId: string | null;
  botUsername: string | null;
  botName: string | null;
  botId: string | null;
  connectedAt: Date | null;
  webhookSecret: string | null;
}

function getEnvFallbackToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

function getEnvFallbackChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_NOTIFY_CHAT_IDS ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function getAppPublicUrl(): string {
  const configured =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export async function getCompanyTelegramConfig(companyId: string): Promise<CompanyTelegramConfig> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      telegramBotToken: true,
      telegramBotId: true,
      telegramBotUsername: true,
      telegramBotName: true,
      telegramDefaultChatId: true,
      telegramWebhookSecret: true,
      telegramConnectedAt: true,
    },
  });

  const token = company?.telegramBotToken?.trim() || getEnvFallbackToken();

  return {
    companyId,
    token: token || null,
    defaultChatId: company?.telegramDefaultChatId?.trim() || null,
    botUsername: company?.telegramBotUsername ?? null,
    botName: company?.telegramBotName ?? null,
    botId: company?.telegramBotId ?? null,
    connectedAt: company?.telegramConnectedAt ?? null,
    webhookSecret: company?.telegramWebhookSecret ?? null,
  };
}

export function isCompanyTelegramConfigured(config: CompanyTelegramConfig): boolean {
  return Boolean(config.token);
}

export function isTelegramConfigured(): boolean {
  return Boolean(getEnvFallbackToken());
}

async function postTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  parseMode?: "HTML",
): Promise<TelegramSendResult> {
  const result = await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...(parseMode ? { parse_mode: parseMode } : {}),
    disable_web_page_preview: true,
  });

  if (!result.ok) {
    return { ok: false, chatId, error: result.error };
  }

  return { ok: true, chatId };
}

export async function sendTelegramMessageWithToken(
  token: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  const htmlResult = await postTelegramMessage(token, chatId, text, "HTML");

  if (htmlResult.ok) {
    return true;
  }

  if (htmlResult.error?.includes("can't parse entities")) {
    const plainResult = await postTelegramMessage(token, chatId, text.replace(/<[^>]+>/g, ""));
    if (!plainResult.ok) {
      console.error("[telegram] send failed (plain):", plainResult.error, "chatId=", chatId);
    }
    return plainResult.ok;
  }

  console.error("[telegram] send failed:", htmlResult.error, "chatId=", chatId);
  return false;
}

/** @deprecated Prefer sendTelegramMessageWithToken with company token */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = getEnvFallbackToken();
  if (!token) {
    console.error("[telegram] send failed: TELEGRAM_BOT_TOKEN is not set");
    return false;
  }
  return sendTelegramMessageWithToken(token, chatId, text);
}

export async function sendTelegramDocumentWithToken(params: {
  token: string;
  chatId: string;
  filePath: string;
  fileName: string;
  caption?: string;
  contentType?: string;
}): Promise<TelegramSendResult> {
  try {
    const bytes = await readFile(params.filePath);
    const form = new FormData();
    form.append("chat_id", params.chatId);
    form.append(
      "document",
      new Blob([bufferToBlobPart(bytes)], {
        type: params.contentType || guessUploadContentType(params.fileName),
      }),
      params.fileName,
    );
    if (params.caption?.trim()) {
      const caption =
        params.caption.length > 1024 ? `${params.caption.slice(0, 1020).trim()}…` : params.caption;
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }

    const result = await callTelegramApiForm(params.token, "sendDocument", form);
    if (!result.ok) {
      // retry caption without HTML if parse fails
      if (result.error?.includes("can't parse entities") && params.caption) {
        const plainForm = new FormData();
        plainForm.append("chat_id", params.chatId);
        plainForm.append(
          "document",
          new Blob([bufferToBlobPart(bytes)], {
            type: params.contentType || guessUploadContentType(params.fileName),
          }),
          params.fileName,
        );
        plainForm.append("caption", params.caption.replace(/<[^>]+>/g, "").slice(0, 1024));
        const plain = await callTelegramApiForm(params.token, "sendDocument", plainForm);
        if (!plain.ok) {
          return { ok: false, chatId: params.chatId, error: plain.error };
        }
        return { ok: true, chatId: params.chatId };
      }
      return { ok: false, chatId: params.chatId, error: result.error };
    }

    return { ok: true, chatId: params.chatId };
  } catch (error) {
    return {
      ok: false,
      chatId: params.chatId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendCompanyTelegramDocument(params: {
  companyId: string;
  chatId: string;
  fileUrl: string;
  caption?: string;
  displayName?: string;
}): Promise<TelegramSendResult> {
  const config = await getCompanyTelegramConfig(params.companyId);
  if (!config.token) {
    return { ok: false, chatId: params.chatId, error: "Telegram-бот компании не настроен" };
  }

  if (!isLocalUploadUrl(params.fileUrl)) {
    return {
      ok: false,
      chatId: params.chatId,
      error: "Поддерживается только локально загруженный файл",
    };
  }

  const fileName =
    params.displayName?.trim() ||
    displayStoredFileName(params.fileUrl.split("/").pop() || "document");

  return sendTelegramDocumentWithToken({
    token: config.token,
    chatId: params.chatId,
    filePath: localUploadFilePath(params.fileUrl),
    fileName,
    caption: params.caption,
    contentType: guessUploadContentType(fileName),
  });
}

function truncateTelegramCaption(caption: string): string {
  return caption.length > 1024 ? `${caption.slice(0, 1020).trim()}…` : caption;
}

function bufferToBlobPart(bytes: Buffer): BlobPart {
  return Uint8Array.from(bytes);
}

function isPhotoMediaType(type: MediaType): boolean {
  return type === MediaType.PHOTO;
}

async function loadTelegramMediaBytes(item: CompanyTelegramMediaItem): Promise<{
  bytes: Buffer;
  fileName: string;
  contentType: string;
  kind: "photo" | "video";
}> {
  const fileName = item.fileName.trim() || "file";
  const kind = isPhotoMediaType(item.type) ? "photo" : "video";
  const opened = await openStoredMediaFile(item.fileUrl, fileName);
  if (!opened.stream) {
    throw new Error("Не удалось прочитать медиафайл");
  }
  const bytes = Buffer.from(await new Response(opened.stream).arrayBuffer());
  return {
    bytes,
    fileName: opened.fileName || fileName,
    contentType: opened.contentType || guessUploadContentType(fileName),
    kind,
  };
}

export async function sendTelegramPhotoWithToken(params: {
  token: string;
  chatId: string;
  bytes: Buffer;
  fileName: string;
  contentType?: string;
  caption?: string;
}): Promise<TelegramSendResult> {
  const form = new FormData();
  form.append("chat_id", params.chatId);
  form.append(
    "photo",
    new Blob([bufferToBlobPart(params.bytes)], {
      type: params.contentType || guessUploadContentType(params.fileName),
    }),
    params.fileName,
  );
  if (params.caption?.trim()) {
    form.append("caption", truncateTelegramCaption(params.caption));
    form.append("parse_mode", "HTML");
  }

  const result = await callTelegramApiForm(params.token, "sendPhoto", form);
  if (!result.ok) {
    if (result.error?.includes("can't parse entities") && params.caption) {
      const plainForm = new FormData();
      plainForm.append("chat_id", params.chatId);
      plainForm.append(
        "photo",
        new Blob([bufferToBlobPart(params.bytes)], {
          type: params.contentType || guessUploadContentType(params.fileName),
        }),
        params.fileName,
      );
      plainForm.append("caption", params.caption.replace(/<[^>]+>/g, "").slice(0, 1024));
      const plain = await callTelegramApiForm(params.token, "sendPhoto", plainForm);
      if (!plain.ok) {
        return { ok: false, chatId: params.chatId, error: plain.error };
      }
      return { ok: true, chatId: params.chatId };
    }
    return { ok: false, chatId: params.chatId, error: result.error };
  }

  return { ok: true, chatId: params.chatId };
}

export async function sendTelegramVideoWithToken(params: {
  token: string;
  chatId: string;
  bytes: Buffer;
  fileName: string;
  contentType?: string;
  caption?: string;
}): Promise<TelegramSendResult> {
  const form = new FormData();
  form.append("chat_id", params.chatId);
  form.append(
    "video",
    new Blob([bufferToBlobPart(params.bytes)], {
      type: params.contentType || guessUploadContentType(params.fileName),
    }),
    params.fileName,
  );
  if (params.caption?.trim()) {
    form.append("caption", truncateTelegramCaption(params.caption));
    form.append("parse_mode", "HTML");
  }

  const result = await callTelegramApiForm(params.token, "sendVideo", form);
  if (!result.ok) {
    return { ok: false, chatId: params.chatId, error: result.error };
  }

  return { ok: true, chatId: params.chatId };
}

export async function sendTelegramMediaGroupWithToken(params: {
  token: string;
  chatId: string;
  items: Array<{
    bytes: Buffer;
    fileName: string;
    contentType: string;
    kind: "photo" | "video";
  }>;
  caption?: string;
}): Promise<TelegramSendResult> {
  const form = new FormData();
  form.append("chat_id", params.chatId);

  const media = params.items.slice(0, 10).map((item, index) => {
    const attachName = `file${index}`;
    form.append(
      attachName,
      new Blob([bufferToBlobPart(item.bytes)], { type: item.contentType }),
      item.fileName,
    );

    const entry: Record<string, string> = {
      type: item.kind,
      media: `attach://${attachName}`,
    };

    if (index === 0 && params.caption?.trim()) {
      entry.caption = truncateTelegramCaption(params.caption);
      entry.parse_mode = "HTML";
    }

    return entry;
  });

  form.append("media", JSON.stringify(media));

  const result = await callTelegramApiForm(params.token, "sendMediaGroup", form);
  if (!result.ok) {
    return { ok: false, chatId: params.chatId, error: result.error };
  }

  return { ok: true, chatId: params.chatId };
}

/** Отправляет клиенту фото/видео (одно вложение или альбом до 10 шт.). */
export async function sendCompanyTelegramMedia(params: {
  companyId: string;
  chatId: string;
  items: CompanyTelegramMediaItem[];
  caption?: string;
}): Promise<TelegramSendResult> {
  const config = await getCompanyTelegramConfig(params.companyId);
  if (!config.token) {
    return { ok: false, chatId: params.chatId, error: "Telegram-бот компании не настроен" };
  }

  if (params.items.length === 0) {
    return { ok: false, chatId: params.chatId, error: "Нет медиа для отправки" };
  }

  const loaded: Array<{
    bytes: Buffer;
    fileName: string;
    contentType: string;
    kind: "photo" | "video";
  }> = [];

  for (const item of params.items.slice(0, 10)) {
    try {
      loaded.push(await loadTelegramMediaBytes(item));
    } catch (error) {
      console.error(
        "[telegram] media load failed:",
        item.fileUrl,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (loaded.length === 0) {
    return { ok: false, chatId: params.chatId, error: "Не удалось прочитать медиафайлы" };
  }

  try {
    if (loaded.length === 1) {
      const item = loaded[0];
      if (item.kind === "photo") {
        return sendTelegramPhotoWithToken({
          token: config.token,
          chatId: params.chatId,
          bytes: item.bytes,
          fileName: item.fileName,
          contentType: item.contentType,
          caption: params.caption,
        });
      }
      return sendTelegramVideoWithToken({
        token: config.token,
        chatId: params.chatId,
        bytes: item.bytes,
        fileName: item.fileName,
        contentType: item.contentType,
        caption: params.caption,
      });
    }

    return sendTelegramMediaGroupWithToken({
      token: config.token,
      items: loaded,
      chatId: params.chatId,
      caption: params.caption,
    });
  } catch (error) {
    return {
      ok: false,
      chatId: params.chatId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatWelcomeMessage(chatId: number | string, botName?: string | null): string {
  const title = botName?.trim() ? botName.trim() : "Auto-CRM Bot";
  return [
    `👋 <b>${title}</b>`,
    "",
    `Ваш Chat ID: <code>${chatId}</code>`,
    "",
    "Скопируйте ID и добавьте в CRM:",
    "Настройки → Telegram → Привязать",
    "",
    "Или отправьте: <code>/link ваш@email.com</code>",
    "",
    "После привязки вы будете получать уведомления о сделках.",
  ].join("\n");
}

export async function sendCompanyTelegramMessages(params: {
  token: string;
  chatIds: Array<string | null | undefined>;
  text: string;
}): Promise<TelegramSendResult[]> {
  const unique = [...new Set(params.chatIds.filter((id): id is string => Boolean(id?.trim())))];

  return Promise.all(
    unique.map(async (chatId) => {
      const htmlResult = await postTelegramMessage(params.token, chatId, params.text, "HTML");
      if (htmlResult.ok) return htmlResult;
      if (htmlResult.error?.includes("can't parse entities")) {
        return postTelegramMessage(params.token, chatId, params.text.replace(/<[^>]+>/g, ""));
      }
      return htmlResult;
    }),
  );
}

/** @deprecated */
export async function sendToTelegramChatIds(
  chatIds: Array<string | null | undefined>,
  text: string,
): Promise<TelegramSendResult[]> {
  const token = getEnvFallbackToken();
  if (!token) {
    return chatIds
      .filter((id): id is string => Boolean(id?.trim()))
      .map((chatId) => ({ ok: false, chatId, error: "TELEGRAM_BOT_TOKEN is not set" }));
  }
  return sendCompanyTelegramMessages({ token, chatIds, text });
}

export function getDefaultTelegramChatIds(companyDefaultChatId?: string | null): string[] {
  if (companyDefaultChatId?.trim()) {
    return companyDefaultChatId
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return getEnvFallbackChatIds();
}

export async function sendTestTelegramNotification(params: {
  companyId: string;
  chatId: string;
  userName: string;
}): Promise<TelegramSendResult> {
  const config = await getCompanyTelegramConfig(params.companyId);
  if (!config.token) {
    return { ok: false, chatId: params.chatId, error: "Telegram-бот компании не настроен" };
  }

  const text = await formatTestNotificationMessage(params.companyId, params.userName);
  const result = await postTelegramMessage(config.token, params.chatId, text, "HTML");
  if (result.ok) return result;
  return postTelegramMessage(config.token, params.chatId, text.replace(/<[^>]+>/g, ""));
}

export interface TelegramBotIdentity {
  id: number;
  username?: string;
  first_name: string;
}

export async function fetchTelegramBotIdentity(
  token: string,
): Promise<{ ok: true; bot: TelegramBotIdentity } | { ok: false; error: string }> {
  const result = await callTelegramApi<TelegramBotIdentity>(token, "getMe");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, bot: result.result };
}

export async function setCompanyTelegramWebhook(params: {
  token: string;
  companyId: string;
  secret: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${getAppPublicUrl()}/api/telegram/webhook/${params.companyId}`;
  const result = await callTelegramApi(params.token, "setWebhook", {
    url,
    secret_token: params.secret,
    drop_pending_updates: true,
    allowed_updates: ["message"],
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

export async function deleteTelegramWebhook(token: string): Promise<void> {
  await callTelegramApi(token, "deleteWebhook", { drop_pending_updates: true });
}

export function createTelegramWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export async function connectCompanyTelegramBot(params: {
  companyId: string;
  token: string;
  defaultChatId?: string | null;
}): Promise<
  | {
      ok: true;
      botUsername: string | null;
      botName: string | null;
      botId: string;
    }
  | { ok: false; error: string }
> {
  const token = params.token.trim();
  const identity = await fetchTelegramBotIdentity(token);
  if (!identity.ok) {
    return { ok: false, error: identity.error };
  }

  const secret = createTelegramWebhookSecret();
  const webhook = await setCompanyTelegramWebhook({
    token,
    companyId: params.companyId,
    secret,
  });
  if (!webhook.ok) {
    return { ok: false, error: webhook.error };
  }

  await prisma.company.update({
    where: { id: params.companyId },
    data: {
      telegramBotToken: token,
      telegramBotId: String(identity.bot.id),
      telegramBotUsername: identity.bot.username ?? null,
      telegramBotName: identity.bot.first_name,
      telegramDefaultChatId: params.defaultChatId?.trim() || null,
      telegramWebhookSecret: secret,
      telegramConnectedAt: new Date(),
    },
  });

  return {
    ok: true,
    botUsername: identity.bot.username ?? null,
    botName: identity.bot.first_name,
    botId: String(identity.bot.id),
  };
}

export async function disconnectCompanyTelegramBot(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { telegramBotToken: true },
  });

  if (company?.telegramBotToken) {
    await deleteTelegramWebhook(company.telegramBotToken);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      telegramBotToken: null,
      telegramBotId: null,
      telegramBotUsername: null,
      telegramBotName: null,
      telegramDefaultChatId: null,
      telegramWebhookSecret: null,
      telegramConnectedAt: null,
    },
  });
}
