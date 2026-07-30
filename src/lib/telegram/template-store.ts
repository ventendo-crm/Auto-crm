import { prisma } from "@/lib/prisma";
import type { TelegramTemplateKey } from "@/lib/telegram/templates";

export interface TelegramTemplateRecord {
  key: TelegramTemplateKey;
  name: string;
  textBody: string;
  description: string | null;
  updatedAt: Date;
  updatedById: string | null;
}

const DEFAULT_TEMPLATES: Record<
  TelegramTemplateKey,
  Omit<TelegramTemplateRecord, "updatedAt" | "updatedById">
> = {
  STAGE_CHANGE: {
    key: "STAGE_CHANGE",
    name: "Смена этапа (сотрудники)",
    textBody: `🚗 <b>Сделка переведена</b>

<b>Клиент:</b> {{clientName}}
<b>VIN:</b> {{vin}}

<b>Этап:</b>
{{fromStage}} → {{toStage}}

<b>Менеджер:</b> {{managerName}}
<b>Изменил:</b> {{changedByName}}

<b>Дата:</b> {{date}}`,
    description:
      "Уведомление менеджерам при смене этапа. Переменные: {{clientName}}, {{vin}}, {{fromStage}}, {{toStage}}, {{managerName}}, {{changedByName}}, {{date}}. Можно использовать HTML-теги Telegram: <b>, <i>, <code>.",
  },
  CLIENT_STAGE: {
    key: "CLIENT_STAGE",
    name: "Смена этапа (клиент)",
    textBody: `📣 <b>Обновление по вашей сделке</b>

<b>Этап:</b> {{stageLabel}}

{{body}}
{{carLine}}
{{vinLine}}

Подробности — в личном кабинете Auto-CRM.`,
    description:
      "Уведомление клиенту при смене этапа. Переменные: {{stageLabel}}, {{body}}, {{carLine}}, {{vinLine}}.",
  },
  COMMENT: {
    key: "COMMENT",
    name: "Новый комментарий",
    textBody: `💬 <b>Новый комментарий</b>

<b>Клиент:</b> {{clientName}}
<b>VIN:</b> {{vin}}
<b>Автор:</b> {{authorName}} ({{authorRole}})

{{commentText}}`,
    description:
      "Уведомление о комментарии. Переменные: {{clientName}}, {{vin}}, {{authorName}}, {{authorRole}}, {{commentText}}.",
  },
  TEST: {
    key: "TEST",
    name: "Тестовое сообщение",
    textBody: `✅ <b>Auto-CRM — тестовое уведомление</b>

Аккаунт: {{userName}}
Если вы видите это сообщение, Telegram настроен правильно.`,
    description: "Тест из настроек профиля. Переменные: {{userName}}.",
  },
};

function isTelegramTemplateKey(value: string): value is TelegramTemplateKey {
  return value in DEFAULT_TEMPLATES;
}

export async function ensureTelegramTemplates(): Promise<void> {
  for (const template of Object.values(DEFAULT_TEMPLATES)) {
    await prisma.telegramTemplate.upsert({
      where: { key: template.key },
      create: {
        ...template,
        updatedAt: new Date(),
      },
      update: {},
    });
  }
}

export async function listTelegramTemplates(): Promise<TelegramTemplateRecord[]> {
  await ensureTelegramTemplates();

  const items = await prisma.telegramTemplate.findMany({
    orderBy: { key: "asc" },
  });

  return items
    .filter((item): item is typeof item & { key: TelegramTemplateKey } =>
      isTelegramTemplateKey(item.key),
    )
    .map((item) => ({
      key: item.key,
      name: item.name,
      textBody: item.textBody,
      description: item.description,
      updatedAt: item.updatedAt,
      updatedById: item.updatedById,
    }));
}

export async function getTelegramTemplateRecord(
  key: TelegramTemplateKey,
): Promise<TelegramTemplateRecord> {
  await ensureTelegramTemplates();

  const record = await prisma.telegramTemplate.findUnique({ where: { key } });
  if (record && isTelegramTemplateKey(record.key)) {
    return {
      key: record.key,
      name: record.name,
      textBody: record.textBody,
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

export async function updateTelegramTemplate(
  key: TelegramTemplateKey,
  data: {
    textBody: string;
    updatedById: string;
  },
): Promise<TelegramTemplateRecord> {
  await ensureTelegramTemplates();

  const updated = await prisma.telegramTemplate.update({
    where: { key },
    data: {
      textBody: data.textBody,
      updatedById: data.updatedById,
    },
  });

  return {
    key: updated.key as TelegramTemplateKey,
    name: updated.name,
    textBody: updated.textBody,
    description: updated.description,
    updatedAt: updated.updatedAt,
    updatedById: updated.updatedById,
  };
}
