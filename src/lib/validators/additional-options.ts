import { z } from "zod";
import {
  isCustomAdditionalOptionKey,
  isValidAdditionalOptionGroupId,
  isValidAdditionalOptionKey,
} from "@/lib/additional-options";

export const toggleAdditionalOptionSchema = z.object({
  optionKey: z
    .string()
    .min(1)
    .refine(
      (key) => isValidAdditionalOptionKey(key) || isCustomAdditionalOptionKey(key),
      { message: "Unknown option key" },
    ),
  checked: z.boolean(),
});

export const createAdditionalOptionSchema = z.object({
  label: z.string().trim().min(1, "Введите название").max(200),
  groupId: z
    .string()
    .min(1)
    .refine(isValidAdditionalOptionGroupId, { message: "Неизвестная категория" }),
});
