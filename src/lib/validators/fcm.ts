import { z } from "zod";

export const fcmSubscribeSchema = z.object({
  token: z.string().min(1).max(4096),
  label: z.string().max(120).optional(),
});

export const fcmUnsubscribeSchema = z.object({
  token: z.string().min(1).max(4096),
});
