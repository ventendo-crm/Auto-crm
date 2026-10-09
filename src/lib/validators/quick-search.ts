import { z } from "zod";

const quickSearchSuggestionSchema = z.object({
  title: z.string().nullable(),
  originCountry: z.string().nullable(),
  engineKind: z.enum(["ice", "hybrid", "phev", "electric"]).nullable(),
  hybridLayout: z.enum(["series", "parallel"]).nullable(),
  engine: z.enum(["petrol", "diesel", "electric"]).nullable(),
  powerHp: z.number().positive().nullable(),
  icePowerHp: z.number().positive().nullable(),
  electricPowerHp: z.number().positive().nullable(),
  volumeCc: z.number().positive().nullable(),
  price: z.number().positive().nullable(),
  currency: z.enum(["RUB", "USD", "CNY", "KRW"]).nullable(),
  age: z.enum(["new", "under3", "from3to5", "from5to7", "over7"]).nullable(),
  importer: z.enum(["personal", "resale", "legal"]).nullable(),
  note: z.string().nullable(),
});

/** Обратная совместимость: тело без mode = обычный поиск. */
export const quickSearchBodySchema = z.union([
  z.object({
    query: z.string().trim().min(3, "Слишком короткий запрос").max(500),
    mode: z.literal("refill"),
    missing: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    base: quickSearchSuggestionSchema,
  }),
  z.object({
    query: z.string().trim().min(3, "Слишком короткий запрос").max(500),
    mode: z.literal("search").optional(),
  }),
]);

/** @deprecated используйте quickSearchBodySchema */
export const quickSearchSchema = z.object({
  query: z.string().trim().min(3, "Слишком короткий запрос").max(500),
});
