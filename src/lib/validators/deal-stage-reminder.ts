import { z } from "zod";
import {
  isStageReminderTimeZone,
  parseStageReminderSendTime,
  STAGE_REMINDER_MAX_DAYS,
  STAGE_REMINDER_MIN_DAYS,
} from "@/lib/preparation-reminders/message";

export const dealStageReminderSchema = z.object({
  enabled: z.boolean(),
  intervalDays: z
    .number()
    .int("Укажите целое число дней")
    .min(STAGE_REMINDER_MIN_DAYS, "Минимум 1 день")
    .max(STAGE_REMINDER_MAX_DAYS, "Максимум 365 дней"),
  sendTime: z.string().refine((value) => parseStageReminderSendTime(value) != null, "Укажите время в формате ЧЧ:ММ"),
  timeZone: z.string().refine((value) => isStageReminderTimeZone(value), "Выберите часовой пояс"),
});

export type DealStageReminderInput = z.infer<typeof dealStageReminderSchema>;
