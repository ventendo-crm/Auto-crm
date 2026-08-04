import { z } from "zod";

const optionalSlugSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return normalized === "" ? undefined : normalized;
}, z
  .string()
  .min(2, "Slug: минимум 2 символа")
  .max(48, "Slug: максимум 48 символов")
  .regex(/^[a-z0-9-]+$/, "Slug: только латиница, цифры и дефис")
  .optional());

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Укажите название компании").max(120),
  slug: optionalSlugSchema,
  adminName: z.string().trim().min(2, "Укажите имя ADMIN").max(120),
  adminEmail: z.string().trim().email("Некорректный email ADMIN"),
  adminPassword: z
    .string()
    .min(8, "Пароль ADMIN: минимум 8 символов")
    .max(72, "Пароль ADMIN: максимум 72 символа"),
});

export const connectTelegramBotSchema = z.object({
  token: z.string().trim().min(20).max(200),
  defaultChatId: z.string().trim().max(64).optional().nullable(),
});
