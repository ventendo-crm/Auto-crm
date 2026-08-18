import { z } from "zod";

export const upsertVariantCustomsEstimateSchema = z.object({
  price: z.number().positive(),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  powerHp: z.number().int().positive(),
  volumeCc: z.number().int().nonnegative(),
  carYear: z.number().int().min(1980).max(2100),
  chinaExpensesCny: z.number().nonnegative().optional(),
  cityDeliveryUsd: z.number().nonnegative().optional(),
  koreaDocsDeliveryKrw: z.number().nonnegative().optional(),
  parkingFeeKrw: z.number().nonnegative().optional(),
  brokerFeeRub: z.number().nonnegative().optional(),
  deliveryRoute: z.enum(["ussuriysk", "kazakhstan", "vladivostok"]).optional(),
  deliveryRub: z.number().nonnegative().optional(),
  deliveryUsd: z.number().nonnegative().optional(),
  escortRub: z.number().nonnegative().optional(),
  note: z.string().trim().max(500).optional().nullable(),
});
