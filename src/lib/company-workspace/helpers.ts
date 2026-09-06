import { DealStageType } from "@prisma/client";
import {
  DOCUMENT_LABELS,
  PASSPORT_DOCUMENT_TYPES,
  PASSPORT_NOTARIZED_COPY_DOCUMENT_TYPES,
  STAGE_ORDER,
} from "@/lib/constants";
import type {
  CompanyDocumentType,
  CustomDealField,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";

export const DOCUMENT_TYPE_KEY_RE = /^[A-Z][A-Z0-9_]{1,62}$/;

export const COMPANION_DOCUMENT_TYPES: Record<string, string> = {
  PASSPORT: "PASSPORT_2",
  PASSPORT_NOTARIZED_COPY: "PASSPORT_NOTARIZED_COPY_2",
};

export const COMPANION_DOCUMENT_PARENT: Record<string, string> = {
  PASSPORT_2: "PASSPORT",
  PASSPORT_NOTARIZED_COPY_2: "PASSPORT_NOTARIZED_COPY",
};

const BUILTIN_DOCUMENT_KEYS = new Set(Object.keys(DOCUMENT_LABELS));

export function isDocumentTypeKey(value: string): boolean {
  return DOCUMENT_TYPE_KEY_RE.test(value);
}

export function isCompanionDocumentType(type: string): boolean {
  return type in COMPANION_DOCUMENT_PARENT;
}

export function isBuiltinDocumentType(type: string): boolean {
  return BUILTIN_DOCUMENT_KEYS.has(type);
}

export function getEnabledDocumentTypeKeys(
  documentTypes: readonly CompanyDocumentType[],
): string[] {
  const keys: string[] = [];
  for (const item of documentTypes) {
    if (!item.enabled) continue;
    keys.push(item.key);
    const companion = COMPANION_DOCUMENT_TYPES[item.key];
    if (companion) keys.push(companion);
  }
  return keys;
}

export function getDocumentTypesForGroup(
  documentTypes: readonly CompanyDocumentType[],
  group: CompanyDocumentType["group"],
): string[] {
  return documentTypes.filter((item) => item.enabled && item.group === group).map((item) => item.key);
}

const RECEIVED_FALLBACK_KEYS = new Set(["EPTS", "PTD", "SBKTS"]);

export function documentTypesForDealGroup(
  catalog: readonly CompanyDocumentType[],
  group: CompanyDocumentType["group"],
  documents: Array<{ type: string; fileUrl?: string | null }>,
): string[] {
  const enabled = getDocumentTypesForGroup(catalog, group);
  const present = new Set(enabled);
  const result = [...enabled];

  for (const doc of documents) {
    if (!doc.fileUrl) continue;
    const parent = COMPANION_DOCUMENT_PARENT[doc.type] ?? doc.type;
    if (present.has(parent) || present.has(doc.type)) continue;
    const catalogItem = catalog.find((item) => item.key === parent);
    const docGroup =
      catalogItem?.group ?? (RECEIVED_FALLBACK_KEYS.has(parent) ? "received" : "main");
    if (docGroup !== group) continue;
    result.push(parent);
    present.add(parent);
  }

  return result;
}

export function getDocumentLabel(
  type: string,
  documentTypes: readonly CompanyDocumentType[] = [],
): string {
  const found = documentTypes.find((item) => item.key === type);
  if (found?.label) return found.label;

  const parentKey = COMPANION_DOCUMENT_PARENT[type];
  if (parentKey) {
    const parent = documentTypes.find((item) => item.key === parentKey);
    const builtin = DOCUMENT_LABELS[type as keyof typeof DOCUMENT_LABELS];
    if (builtin) return builtin;
    if (parent?.label) return `${parent.label} (2-й файл)`;
  }

  return DOCUMENT_LABELS[type as keyof typeof DOCUMENT_LABELS] ?? type;
}

export function clientProgressStages(
  visible: readonly DealStageType[],
  current: DealStageType,
): DealStageType[] {
  const allowed = new Set(visible);
  allowed.add(current);
  return STAGE_ORDER.filter((stage) => allowed.has(stage));
}

export function parseCustomFieldValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") {
      result[key] = raw;
    } else if (raw != null) {
      result[key] = String(raw);
    }
  }
  return result;
}

export function enabledCustomDealFields(
  fields: readonly CustomDealField[],
): CustomDealField[] {
  return fields.filter((field) => field.enabled);
}

export function isPassportPairType(type: string): boolean {
  return (PASSPORT_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function isPassportNotarizedPairType(type: string): boolean {
  return (PASSPORT_NOTARIZED_COPY_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function fieldIsEnabled(
  settings: ResolvedCompanyWorkspace,
  key: keyof ResolvedCompanyWorkspace["dealFields"],
): boolean {
  return settings.dealFields[key].enabled;
}

export function fieldIsRequired(
  settings: ResolvedCompanyWorkspace,
  key: keyof ResolvedCompanyWorkspace["dealFields"],
): boolean {
  const field = settings.dealFields[key];
  return field.enabled && field.required;
}
