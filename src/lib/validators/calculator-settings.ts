import { z } from "zod";

const exchangeRatesSchema = z.object({
  USD: z.number().positive(),
  EUR: z.number().positive(),
  CNY: z.number().positive(),
  KRW: z.number().positive(),
});

export const calculatorPresetSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  savedAt: z.string().min(1).max(40),
  originCountry: z.enum(["china", "korea", "kyrgyzstan"]),
  importer: z.enum(["personal", "resale", "legal"]),
  age: z.enum(["new", "under3", "from3to5", "from5to7", "over7"]),
  engine: z.enum(["petrol", "diesel", "electric"]),
  powerHp: z.string().max(32),
  volumeCc: z.string().max(32),
  price: z.string().max(32),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]),
  chinaExpensesCny: z.string().max(32),
  cityDeliveryUsd: z.string().max(32).optional(),
  koreaDocsDeliveryKrw: z.string().max(32),
  parkingFeeKrw: z.string().max(32),
  brokerFeeRub: z.string().max(32),
  deliveryRoute: z.enum(["ussuriysk", "kazakhstan", "vladivostok"]),
  deliveryRub: z.string().max(32),
  deliveryUsd: z.string().max(32),
  escortRub: z.string().max(32),
  rates: exchangeRatesSchema,
});

export const updateCalculatorSettingsSchema = z.object({
  presets: z.array(calculatorPresetSchema).max(20),
});

export type CalculatorPresetInput = z.infer<typeof calculatorPresetSchema>;
