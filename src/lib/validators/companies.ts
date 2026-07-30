import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Slug: латиница, цифры и дефис")
    .optional(),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(8).max(72),
});

export const connectTelegramBotSchema = z.object({
  token: z.string().trim().min(20).max(200),
  defaultChatId: z.string().trim().max(64).optional().nullable(),
});
