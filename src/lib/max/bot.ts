import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { htmlToPlainText } from "@/lib/max/html";
import { callMaxApi } from "@/lib/max/http";
import { getAppPublicUrl } from "@/lib/telegram/bot";

export interface MaxSendResult {
  ok: boolean;
  userId: string;
  error?: string;
}

export interface CompanyMaxConfig {
  companyId: string;
  token: string | null;
  botUsername: string | null;
  botName: string | null;
  botId: string | null;
  connectedAt: Date | null;
  webhookSecret: string | null;
}

export interface MaxBotIdentity {
  user_id?: number;
  userId?: number;
  user_id_str?: string;
  first_name?: string;
  name?: string;
  username?: string;
  is_bot?: boolean;
}

export async function getCompanyMaxConfig(companyId: string): Promise<CompanyMaxConfig> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      maxBotToken: true,
      maxBotId: true,
      maxBotUsername: true,
      maxBotName: true,
      maxWebhookSecret: true,
      maxConnectedAt: true,
    },
  });

  return {
    companyId,
    token: company?.maxBotToken?.trim() || null,
    botUsername: company?.maxBotUsername ?? null,
    botName: company?.maxBotName ?? null,
    botId: company?.maxBotId ?? null,
    connectedAt: company?.maxConnectedAt ?? null,
    webhookSecret: company?.maxWebhookSecret ?? null,
  };
}

export function isCompanyMaxConfigured(config: CompanyMaxConfig): boolean {
  return Boolean(config.token);
}

export async function fetchMaxBotIdentity(
  token: string,
): Promise<{ ok: true; bot: MaxBotIdentity } | { ok: false; error: string }> {
  const result = await callMaxApi<MaxBotIdentity>({
    token,
    method: "GET",
    path: "/me",
  });
  if (!result.ok) {
    if (result.status === 401) {
      return { ok: false, error: "Токен MAX недействителен. Проверьте его в @MasterBot." };
    }
    return { ok: false, error: result.error };
  }
  return { ok: true, bot: result.data };
}

function botIdFromIdentity(bot: MaxBotIdentity): string {
  if (bot.user_id != null) return String(bot.user_id);
  if (bot.userId != null) return String(bot.userId);
  return "";
}

function botNameFromIdentity(bot: MaxBotIdentity): string {
  return bot.name?.trim() || bot.first_name?.trim() || "MAX-бот";
}

export async function sendMaxMessageWithToken(
  token: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const plain = htmlToPlainText(text);
  if (!plain) return false;

  const result = await callMaxApi({
    token,
    method: "POST",
    path: "/messages",
    query: { user_id: userId },
    body: { text: plain.slice(0, 4000) },
  });

  if (!result.ok) {
    console.error("[max] send failed:", result.error, "userId=", userId);
    return false;
  }
  return true;
}

export async function sendCompanyMaxMessages(params: {
  token: string;
  userIds: Array<string | null | undefined>;
  text: string;
}): Promise<MaxSendResult[]> {
  const unique = [...new Set(params.userIds.filter((id): id is string => Boolean(id?.trim())))];
  const results: MaxSendResult[] = [];
  for (const userId of unique) {
    const ok = await sendMaxMessageWithToken(params.token, userId, params.text);
    results.push(ok ? { ok: true, userId } : { ok: false, userId, error: "MAX не принял сообщение" });
  }
  return results;
}

export async function sendTestMaxNotification(params: {
  companyId: string;
  userId: string;
  userName: string;
}): Promise<MaxSendResult> {
  const config = await getCompanyMaxConfig(params.companyId);
  if (!config.token) {
    return { ok: false, userId: params.userId, error: "MAX-бот компании не настроен" };
  }

  const text = [
    "Auto-CRM",
    "",
    `Привет, ${params.userName}.`,
    "MAX привязан. Сюда будут приходить уведомления о сделках.",
  ].join("\n");

  const delivered = await sendMaxMessageWithToken(config.token, params.userId, text);
  return delivered
    ? { ok: true, userId: params.userId }
    : { ok: false, userId: params.userId, error: "Не удалось отправить сообщение в MAX" };
}

export function formatMaxWelcomeMessage(userId: string, botName?: string | null): string {
  const title = botName?.trim() ? botName.trim() : "Auto-CRM MAX";
  return [
    title,
    "",
    `Ваш ID в MAX: ${userId}`,
    "",
    "Скопируйте ID и добавьте в CRM: Настройки → Профиль → Уведомления в MAX.",
    "Или отправьте: /link ваш@email.com",
    "",
    "После привязки вы будете получать уведомления о сделках.",
  ].join("\n");
}

export function createMaxWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export async function setCompanyMaxWebhook(params: {
  token: string;
  companyId: string;
  secret: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${getAppPublicUrl()}/api/max/webhook/${params.companyId}`;
  const result = await callMaxApi({
    token: params.token,
    method: "POST",
    path: "/subscriptions",
    body: {
      url,
      update_types: ["bot_started", "message_created"],
      secret: params.secret,
    },
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error ||
        "MAX не принял webhook. Нужен публичный HTTPS (порт 443), как у importcrm.ru.",
    };
  }
  return { ok: true };
}

export async function deleteMaxWebhook(token: string, companyId: string): Promise<void> {
  const url = `${getAppPublicUrl()}/api/max/webhook/${companyId}`;
  await callMaxApi({
    token,
    method: "DELETE",
    path: "/subscriptions",
    query: { url },
  });
}

export async function connectCompanyMaxBot(params: {
  companyId: string;
  token: string;
}): Promise<
  | { ok: true; botUsername: string | null; botName: string | null; botId: string }
  | { ok: false; error: string }
> {
  const token = params.token.trim();
  const identity = await fetchMaxBotIdentity(token);
  if (!identity.ok) {
    return { ok: false, error: identity.error };
  }

  const botId = botIdFromIdentity(identity.bot);
  if (!botId) {
    return { ok: false, error: "MAX не вернул ID бота. Проверьте токен." };
  }

  const secret = createMaxWebhookSecret();
  const webhook = await setCompanyMaxWebhook({
    token,
    companyId: params.companyId,
    secret,
  });
  if (!webhook.ok) {
    return { ok: false, error: webhook.error };
  }

  const botName = botNameFromIdentity(identity.bot);
  const botUsername = identity.bot.username?.replace(/^@/, "") || null;

  await prisma.company.update({
    where: { id: params.companyId },
    data: {
      maxBotToken: token,
      maxBotId: botId,
      maxBotUsername: botUsername,
      maxBotName: botName,
      maxWebhookSecret: secret,
      maxConnectedAt: new Date(),
    },
  });

  return {
    ok: true,
    botUsername,
    botName,
    botId,
  };
}

export async function disconnectCompanyMaxBot(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { maxBotToken: true },
  });

  if (company?.maxBotToken) {
    await deleteMaxWebhook(company.maxBotToken, companyId);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      maxBotToken: null,
      maxBotId: null,
      maxBotUsername: null,
      maxBotName: null,
      maxWebhookSecret: null,
      maxConnectedAt: null,
    },
  });
}
