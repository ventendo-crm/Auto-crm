import { prisma } from "@/lib/prisma";
import type { EmailTemplateKey } from "@/lib/email/templates";

export interface EmailTemplateRecord {
  key: EmailTemplateKey;
  name: string;
  subject: string;
  textBody: string;
  htmlTitle: string;
  description: string | null;
  updatedAt: Date;
  updatedById: string | null;
}

const DEFAULT_TEMPLATES: Record<
  EmailTemplateKey,
  Omit<EmailTemplateRecord, "updatedAt" | "updatedById">
> = {
  CLIENT_STAGE: {
    key: "CLIENT_STAGE",
    name: "Смена этапа сделки",
    subject: "ImportCRM: этап «{{stageLabel}}»",
    textBody: `Обновление по вашей сделке

Этап: {{stageLabel}}

{{body}}
{{carLine}}
{{vinLine}}

Подробности — в личном кабинете:
{{portalUrl}}`,
    htmlTitle: "Обновление по вашей сделке",
    description:
      "Письмо клиенту при смене этапа. Переменные: {{stageLabel}}, {{body}}, {{carLine}}, {{vinLine}}, {{portalUrl}}",
  },
  CLIENT_COMMENT: {
    key: "CLIENT_COMMENT",
    name: "Комментарий менеджера",
    subject: "ImportCRM: новый комментарий по вашей сделке",
    textBody: `Менеджер оставил комментарий по вашей сделке

Клиент: {{clientName}}
VIN: {{vin}}
Автор: {{authorName}} ({{authorRole}})

{{commentText}}

Личный кабинет: {{portalUrl}}`,
    htmlTitle: "Новый комментарий",
    description:
      "Письмо при комментарии сотрудника. Переменные: {{clientName}}, {{vin}}, {{authorName}}, {{authorRole}}, {{commentText}}, {{portalUrl}}",
  },
  CLIENT_TEST: {
    key: "CLIENT_TEST",
    name: "Тестовое письмо",
    subject: "ImportCRM: тестовое уведомление",
    textBody: `Тестовое email-уведомление

Аккаунт: {{userName}}
Если вы видите это письмо, почта настроена правильно.`,
    htmlTitle: "Тестовое уведомление",
    description: "Тест из профиля клиента. Переменные: {{userName}}",
  },
};

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return value in DEFAULT_TEMPLATES;
}

export async function ensureEmailTemplates(): Promise<void> {
  for (const template of Object.values(DEFAULT_TEMPLATES)) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      create: {
        ...template,
        updatedAt: new Date(),
      },
      update: {},
    });
  }
}

export async function listEmailTemplates(): Promise<EmailTemplateRecord[]> {
  await ensureEmailTemplates();

  const items = await prisma.emailTemplate.findMany({
    orderBy: { key: "asc" },
  });

  return items
    .filter((item): item is typeof item & { key: EmailTemplateKey } => isEmailTemplateKey(item.key))
    .map((item) => ({
      key: item.key,
      name: item.name,
      subject: item.subject,
      textBody: item.textBody,
      htmlTitle: item.htmlTitle,
      description: item.description,
      updatedAt: item.updatedAt,
      updatedById: item.updatedById,
    }));
}

export async function getEmailTemplateRecord(key: EmailTemplateKey): Promise<EmailTemplateRecord> {
  await ensureEmailTemplates();

  const record = await prisma.emailTemplate.findUnique({ where: { key } });
  if (record && isEmailTemplateKey(record.key)) {
    return {
      key: record.key,
      name: record.name,
      subject: record.subject,
      textBody: record.textBody,
      htmlTitle: record.htmlTitle,
      description: record.description,
      updatedAt: record.updatedAt,
      updatedById: record.updatedById,
    };
  }

  return {
    ...DEFAULT_TEMPLATES[key],
    updatedAt: new Date(),
    updatedById: null,
  };
}

export async function updateEmailTemplate(
  key: EmailTemplateKey,
  data: {
    subject: string;
    textBody: string;
    htmlTitle: string;
    updatedById: string;
  },
): Promise<EmailTemplateRecord> {
  await ensureEmailTemplates();

  const updated = await prisma.emailTemplate.update({
    where: { key },
    data: {
      subject: data.subject,
      textBody: data.textBody,
      htmlTitle: data.htmlTitle,
      updatedById: data.updatedById,
    },
  });

  return {
    key: updated.key as EmailTemplateKey,
    name: updated.name,
    subject: updated.subject,
    textBody: updated.textBody,
    htmlTitle: updated.htmlTitle,
    description: updated.description,
    updatedAt: updated.updatedAt,
    updatedById: updated.updatedById,
  };
}
