import { z } from "zod";

const exchangeRatesSchema = z.object({
  USD: z.number().positive(),
  EUR: z.number().positive(),
  CNY: z.number().positive(),
  KRW: z.number().positive(),
});

export const customsEstimateInputSchema = z.object({
  originCountry: z.enum(["china", "korea", "kyrgyzstan"]).optional(),
  importer: z.enum(["personal", "resale", "legal"]),
  age: z.enum(["new", "under3", "from3to5", "from5to7", "over7"]),
  engine: z.enum(["petrol", "diesel", "electric"]),
  powerHp: z.number().positive(),
  volumeCc: z.number().nonnegative(),
  price: z.number().positive(),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  rates: exchangeRatesSchema,
  chinaExpensesCny: z.number().nonnegative().optional(),
  cityDeliveryUsd: z.number().nonnegative().optional(),
  koreaDocsDeliveryKrw: z.number().nonnegative().optional(),
  parkingFeeKrw: z.number().nonnegative().optional(),
  brokerFeeRub: z.number().nonnegative().optional(),
  deliveryRoute: z.enum(["ussuriysk", "kazakhstan", "vladivostok"]).optional(),
  deliveryRub: z.number().nonnegative().optional(),
  deliveryUsd: z.number().nonnegative().optional(),
  escortRub: z.number().nonnegative().optional(),
});

export const createCustomsEstimateSchema = z.object({
  input: customsEstimateInputSchema,
  note: z.string().trim().max(500).optional().nullable(),
});
