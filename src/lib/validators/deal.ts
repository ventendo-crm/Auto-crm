import { DealStageType } from "@prisma/client";
import { z } from "zod";

const optionalDecimal = z.union([z.number(), z.string()]).optional().nullable();

const dealBaseSchema = z.object({
  clientName: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  vin: z.string().trim().max(17).optional().nullable(),
  carBrand: z.string().max(100).optional().nullable(),
  carModel: z.string().max(100).optional().nullable(),
  carYear: z.number().int().min(1900).max(2100).optional().nullable(),
  purchasePrice: optionalDecimal,
  prepayment: optionalDecimal,
  balance: optionalDecimal,
  destinationCity: z.string().min(1).max(100),
  destinationCountry: z.string().min(1).max(100),
  managerId: z.string().cuid().optional(),
  currentStage: z.nativeEnum(DealStageType).optional(),
  expectedArrival: z.coerce.date().optional().nullable(),
  actualArrival: z.coerce.date().optional().nullable(),
  priority: z.number().int().min(1).max(5).optional(),
});

export const createDealSchema = dealBaseSchema;

export const updateDealSchema = dealBaseSchema.partial();

export const changeStageSchema = z.object({
  toStage: z.nativeEnum(DealStageType),
});

export const listDealsSchema = z.object({
  stage: z.nativeEnum(DealStageType).optional(),
  managerId: z.string().cuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
