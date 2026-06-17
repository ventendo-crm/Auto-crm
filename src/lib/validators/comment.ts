import { z } from "zod";

export const createCommentSchema = z.object({
  text: z.string().min(1).max(5000),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1).max(5000),
});
