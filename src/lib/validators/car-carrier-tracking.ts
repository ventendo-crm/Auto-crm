import { z } from "zod";

const coordinate = z.coerce.number();

export const createCarCarrierTrackingPointSchema = z.object({
  latitude: coordinate.min(-90).max(90),
  longitude: coordinate.min(-180).max(180),
  title: z.string().max(200).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  recordedAt: z.coerce.date().optional(),
});

export const updateCarCarrierTrackingPointSchema = z.object({
  latitude: coordinate.min(-90).max(90).optional(),
  longitude: coordinate.min(-180).max(180).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  recordedAt: z.coerce.date().optional(),
});

export const setCarCarrierDestinationSchema = z.object({
  latitude: coordinate.min(-90).max(90),
  longitude: coordinate.min(-180).max(180),
  title: z.string().max(200).optional().default("Точка назначения"),
});
