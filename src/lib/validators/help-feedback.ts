import { z } from "zod";

export const helpFeedbackSchema = z.object({
  topic: z.enum(["question", "bug", "idea", "other"], {
    errorMap: () => ({ message: "Выберите тему" }),
  }),
  message: z
    .string()
    .trim()
    .min(10, "Опишите подробнее — минимум 10 символов")
    .max(4000, "Слишком длинное сообщение"),
});

export type HelpFeedbackInput = z.infer<typeof helpFeedbackSchema>;
