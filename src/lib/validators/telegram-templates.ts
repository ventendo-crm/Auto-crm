import { z } from "zod";
import { TELEGRAM_TEMPLATE_PLACEHOLDERS } from "@/lib/telegram/templates";

const templateKeys = Object.keys(TELEGRAM_TEMPLATE_PLACEHOLDERS) as [
  keyof typeof TELEGRAM_TEMPLATE_PLACEHOLDERS,
  ...Array<keyof typeof TELEGRAM_TEMPLATE_PLACEHOLDERS>,
];

export const telegramTemplateKeySchema = z.enum(templateKeys);

export const updateTelegramTemplateSchema = z.object({
  textBody: z.string().min(1).max(10000),
});
