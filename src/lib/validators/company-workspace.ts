import { DealStageType } from "@prisma/client";
import { z } from "zod";
import { DOCUMENT_TYPE_KEY_RE } from "@/lib/company-workspace/helpers";

const dealFieldSettingSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
});

const customDealFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  label: z.string().trim().min(1).max(80),
  required: z.boolean(),
  enabled: z.boolean(),
});

const documentTypeSchema = z.object({
  key: z.string().regex(DOCUMENT_TYPE_KEY_RE),
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  group: z.enum(["main", "received"]),
  builtin: z.boolean(),
});

const additionalOptionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  label: z.string().trim().min(1).max(200),
});

const additionalOptionGroupSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  title: z.string().trim().min(1).max(120),
  options: z.array(additionalOptionSchema).max(80),
});

export const companyWorkspacePutSchema = z.object({
  stageLabels: z.record(z.string(), z.string().max(40)).optional(),
  clientVisibleStages: z.array(z.nativeEnum(DealStageType)).optional(),
  dealTabs: z
    .object({
      importProcess: z.boolean(),
      logistics: z.boolean(),
      additionalOptions: z.boolean(),
      searchProcess: z.boolean(),
    })
    .partial()
    .optional(),
  dealFields: z
    .object({
      vin: dealFieldSettingSchema,
      carYear: dealFieldSettingSchema,
      destinationCity: dealFieldSettingSchema,
    })
    .partial()
    .optional(),
  customDealFields: z.array(customDealFieldSchema).max(30).optional(),
  documentTypes: z.array(documentTypeSchema).max(40).optional(),
  additionalOptionGroups: z.array(additionalOptionGroupSchema).max(20).optional(),
  modules: z
    .object({
      catalog: z.boolean(),
      calculator: z.boolean(),
      carCarrier: z.boolean(),
      googleCalendar: z.boolean(),
    })
    .partial()
    .optional(),
});

export type CompanyWorkspacePutInput = z.infer<typeof companyWorkspacePutSchema>;
