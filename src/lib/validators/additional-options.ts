import { z } from "zod";

export const toggleAdditionalOptionSchema = z.object({
  optionKey: z.string().min(1).max(80),
  checked: z.boolean(),
});

export const createAdditionalOptionSchema = z.object({
  label: z.string().trim().min(1, "Введите название").max(200),
  groupId: z.string().min(1).max(80),
});
