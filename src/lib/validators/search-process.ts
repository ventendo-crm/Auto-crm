import { z } from "zod";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";

export const MAX_SEARCH_PROCESS_MEDIA = MAX_PROCESS_ENTRY_MEDIA;

export const updateSearchProcessEntrySchema = z.object({
  description: z.string().max(5000),
});

export const searchProcessFeedbackSchema = z.object({
  feedback: z.string().trim().min(1).max(5000),
});
