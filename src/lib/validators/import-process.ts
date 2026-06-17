import { z } from "zod";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";

export const setImportProcessEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const updateImportProcessEntrySchema = z.object({
  description: z.string().max(5000),
});

export const MAX_IMPORT_PROCESS_MEDIA = MAX_PROCESS_ENTRY_MEDIA;
