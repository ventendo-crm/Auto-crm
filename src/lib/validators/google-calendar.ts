import { z } from "zod";

export const connectGoogleCalendarSchema = z.object({
  googleEmail: z
    .string()
    .trim()
    .email("Укажите корректный email Google-аккаунта")
    .max(254),
});
