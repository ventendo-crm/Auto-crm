import { z } from "zod";
import {
  PREPARATION_REMINDER_MAX_HOURS,
  PREPARATION_REMINDER_MIN_HOURS,
  PREPARATION_REMINDER_TEMPLATE_MAX,
} from "@/lib/preparation-reminders/message";

export const preparationReminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    intervalHours: z
      .number({ invalid_type_error: "Укажите периодичность в часах" })
      .int("Периодичность задаётся целым числом часов")
      .min(PREPARATION_REMINDER_MIN_HOURS, "Минимум 1 час")
      .max(PREPARATION_REMINDER_MAX_HOURS, "Максимум 168 часов (7 суток)"),
    messageTemplate: z
      .string()
      .trim()
      .min(1, "Введите текст напоминания")
      .max(
        PREPARATION_REMINDER_TEMPLATE_MAX,
        `Текст длиннее ${PREPARATION_REMINDER_TEMPLATE_MAX} символов`,
      ),
    recipientMode: z.enum(["ASSIGNED", "SPECIFIC"]),
    specificManagerId: z.string().trim().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.recipientMode === "SPECIFIC" && !value.specificManagerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specificManagerId"],
        message: "Выберите менеджера",
      });
    }
  });

export type PreparationReminderSettingsInput = z.infer<typeof preparationReminderSettingsSchema>;
