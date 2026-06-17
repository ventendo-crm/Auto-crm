import { z } from "zod";
import { isValidAdditionalOptionKey } from "@/lib/additional-options";

export const toggleAdditionalOptionSchema = z.object({
  optionKey: z
    .string()
    .min(1)
    .refine(isValidAdditionalOptionKey, { message: "Unknown option key" }),
  checked: z.boolean(),
});
