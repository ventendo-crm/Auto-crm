import { z } from "zod";

export const catalogVehicleFiltersSchema = z.object({
  q: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  yearFrom: z.coerce.number().int().min(1990).optional(),
  yearTo: z.coerce.number().int().max(2100).optional(),
  priceFrom: z.coerce.number().nonnegative().optional(),
  priceTo: z.coerce.number().nonnegative().optional(),
  mileageTo: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).optional(),
  source: z.enum(["MANUAL", "CHE168", "ALL"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createCatalogVehicleSchema = z.object({
  titleRu: z.string().trim().min(1, "Укажите название"),
  titleZh: z.string().trim().optional(),
  descriptionRu: z.string().trim().optional(),
  descriptionZh: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  carYear: z.coerce.number().int().min(1990).max(2100).optional(),
  mileageKm: z.coerce.number().int().nonnegative().optional(),
  priceCny: z.coerce.number().nonnegative().optional(),
  volumeCc: z.coerce.number().int().positive().optional(),
  powerHp: z.coerce.number().int().positive().optional(),
  fuelType: z.string().trim().optional(),
  transmission: z.string().trim().optional(),
  color: z.string().trim().optional(),
  location: z.string().trim().optional(),
  vin: z.string().trim().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  galleryUrls: z.array(z.string().url()).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
});

export const updateCatalogVehicleSchema = createCatalogVehicleSchema.partial().extend({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export const importChe168Schema = z.object({
  url: z.string().trim().min(1, "Укажите ссылку на Che168"),
  translate: z.boolean().optional(),
});

export const createCatalogSelectionSchema = z.object({
  title: z.string().trim().min(1, "Укажите название подборки"),
  note: z.string().trim().optional(),
  dealId: z.string().trim().optional(),
  vehicleIds: z.array(z.string().trim()).optional(),
});

export const updateCatalogSelectionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  note: z.string().trim().optional(),
  dealId: z.string().trim().nullable().optional(),
});

export const addSelectionItemSchema = z.object({
  catalogVehicleId: z.string().trim().min(1),
  note: z.string().trim().optional(),
});

export const createShareTokenSchema = z.object({
  label: z.string().trim().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const addCatalogVehicleToDealSchema = z.object({
  dealId: z.string().trim().min(1),
  publish: z.boolean().optional(),
});

export const catalogEstimateSchema = z.object({
  destinationCountry: z.string().trim().min(1),
  price: z.coerce.number().positive(),
  currency: z.enum(["CNY", "USD", "KRW", "RUB"]),
  powerHp: z.coerce.number().int().positive(),
  volumeCc: z.coerce.number().int().positive(),
  carYear: z.coerce.number().int().min(1990).max(2100),
  exchangeRate: z.coerce.number().positive().optional(),
  note: z.string().trim().optional(),
});
