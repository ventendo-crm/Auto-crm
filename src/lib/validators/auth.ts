import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  roleId: z.string().cuid(),
  telegramChatId: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(6, "Минимум 6 символов").max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  });

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  companySlug: z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    return normalized === "" ? undefined : normalized;
  }, z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9-]+$/i, "Slug: латиница, цифры и дефис")
    .optional()),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(6, "Минимум 6 символов").max(128),
});
