import { isEmailConfigured } from "@/lib/email/config";
import { buildHtmlFromText } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import type { HelpFeedbackInput } from "@/lib/validators/help-feedback";

const TOPIC_LABELS: Record<HelpFeedbackInput["topic"], string> = {
  question: "Вопрос",
  bug: "Ошибка / баг",
  idea: "Идея / улучшение",
  other: "Другое",
};

export function getFeedbackRecipient(): string | null {
  const dedicated = process.env.FEEDBACK_TO?.trim() || process.env.SUPPORT_EMAIL?.trim();
  if (dedicated) return dedicated.toLowerCase();
  const from = process.env.EMAIL_FROM?.trim();
  return from ? from.toLowerCase() : null;
}

export function isFeedbackConfigured(): boolean {
  return isEmailConfigured() && Boolean(getFeedbackRecipient());
}

export async function sendHelpFeedback(params: {
  topic: HelpFeedbackInput["topic"];
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyName: string;
    companySlug: string;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Отправка почты не настроена на сервере." };
  }

  const to = getFeedbackRecipient();
  if (!to) {
    return {
      ok: false,
      error: "Не указан адрес для обратной связи (FEEDBACK_TO).",
    };
  }

  const topicLabel = TOPIC_LABELS[params.topic];
  const subject = `[Auto-CRM] ${topicLabel}: ${params.user.companyName}`;
  const text = [
    `Тема: ${topicLabel}`,
    "",
    `От: ${params.user.name} <${params.user.email}>`,
    `Роль: ${params.user.role}`,
    `Компания: ${params.user.companyName} (${params.user.companySlug})`,
    `User ID: ${params.user.id}`,
    "",
    "Сообщение:",
    params.message,
  ].join("\n");

  const html = buildHtmlFromText(`Обратная связь — ${topicLabel}`, text);

  const sent = await sendEmail({
    to,
    subject,
    text,
    html,
    replyTo: params.user.email,
  });

  if (!sent.ok) {
    return {
      ok: false,
      error: sent.error || "Не удалось отправить сообщение. Попробуйте позже.",
    };
  }

  return { ok: true };
}
