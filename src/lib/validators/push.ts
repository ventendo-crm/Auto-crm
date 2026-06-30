import { z } from "zod";

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
