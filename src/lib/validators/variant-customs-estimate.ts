import { z } from "zod";

export const upsertVariantCustomsEstimateSchema = z.object({
  price: z.number().positive(),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  powerHp: z.number().int().positive(),
  volumeCc: z.number().int().nonnegative(),
  carYear: z.number().int().min(1980).max(2100),
  note: z.string().trim().max(500).optional().nullable(),
});
