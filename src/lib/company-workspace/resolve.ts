import { DealStageType } from "@prisma/client";
import type { AdditionalOptionGroupDefinition } from "@/lib/additional-options";
import { STAGE_ORDER } from "@/lib/constants";
import { getDefaultCompanyWorkspace, getDefaultDocumentTypes } from "@/lib/company-workspace/defaults";
import {
  COMPANION_DOCUMENT_PARENT,
  DOCUMENT_TYPE_KEY_RE,
  isBuiltinDocumentType,
} from "@/lib/company-workspace/helpers";
import type {
  BuiltInDealFieldKey,
  CompanyDealTabs,
  CompanyDocumentType,
  CompanyModules,
  CustomDealField,
  DealFieldSetting,
  DocumentGroup,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";

const STAGE_SET = new Set<string>(STAGE_ORDER);
const DEAL_TAB_KEYS: Array<keyof CompanyDealTabs> = [
  "importProcess",
  "logistics",
  "additionalOptions",
  "searchProcess",
];
const MODULE_KEYS: Array<keyof CompanyModules> = [
  "catalog",
  "calculator",
  "carCarrier",
  "googleCalendar",
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isDealStageType(value: unknown): value is DealStageType {
  return typeof value === "string" && STAGE_SET.has(value);
}

function resolveStageLabels(raw: unknown): Record<DealStageType, string> {
  const defaults = getDefaultCompanyWorkspace().stageLabels;
  const record = asRecord(raw);
  const result = { ...defaults };
  for (const stage of STAGE_ORDER) {
    const value = record[stage];
    if (typeof value === "string" && value.trim()) {
      result[stage] = value.trim().slice(0, 40);
    }
  }
  return result;
}

function resolveClientVisibleStages(raw: unknown): DealStageType[] {
  if (!Array.isArray(raw)) {
    return [...STAGE_ORDER];
  }
  const seen = new Set<DealStageType>();
  const result: DealStageType[] = [];
  for (const item of raw) {
    if (isDealStageType(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return STAGE_ORDER.filter((stage) => seen.has(stage));
}

function resolveDealTabs(raw: unknown): CompanyDealTabs {
  const defaults = getDefaultCompanyWorkspace().dealTabs;
  const record = asRecord(raw);
  const result = { ...defaults };
  for (const key of DEAL_TAB_KEYS) {
    if (typeof record[key] === "boolean") {
      result[key] = record[key];
    }
  }
  return result;
}

function resolveFieldSetting(raw: unknown, fallback: DealFieldSetting): DealFieldSetting {
  const record = asRecord(raw);
  const enabled = typeof record.enabled === "boolean" ? record.enabled : fallback.enabled;
  const required = typeof record.required === "boolean" ? record.required : fallback.required;
  return {
    enabled,
    required: enabled ? required : false,
  };
}

function resolveDealFields(raw: unknown): Record<BuiltInDealFieldKey, DealFieldSetting> {
  const defaults = getDefaultCompanyWorkspace().dealFields;
  const record = asRecord(raw);
  return {
    vin: resolveFieldSetting(record.vin, defaults.vin),
    carYear: resolveFieldSetting(record.carYear, defaults.carYear),
    destinationCity: resolveFieldSetting(record.destinationCity, defaults.destinationCity),
  };
}

function resolveCustomDealFields(raw: unknown): CustomDealField[] {
  const seen = new Set<string>();
  const result: CustomDealField[] = [];
  for (const item of asArray(raw)) {
    const record = asRecord(item);
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(id) || !label || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      label: label.slice(0, 80),
      required: Boolean(record.required),
      enabled: record.enabled !== false,
    });
    if (result.length >= 30) break;
  }
  return result;
}

function resolveDocumentTypes(raw: unknown): CompanyDocumentType[] {
  const defaults = getDefaultDocumentTypes();
  const items = asArray(raw);
  if (items.length === 0) return defaults;

  const parsed: CompanyDocumentType[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const record = asRecord(item);
    const key = typeof record.key === "string" ? record.key.trim().toUpperCase() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!DOCUMENT_TYPE_KEY_RE.test(key) || key in COMPANION_DOCUMENT_PARENT || seen.has(key) || !label) {
      continue;
    }
    const group: DocumentGroup = record.group === "received" ? "received" : "main";
    parsed.push({
      key,
      label: label.slice(0, 80),
      enabled: record.enabled !== false,
      group,
      builtin: isBuiltinDocumentType(key),
    });
    seen.add(key);
    if (parsed.length >= 40) break;
  }

  for (const builtin of defaults) {
    if (!seen.has(builtin.key)) {
      parsed.push(builtin);
    }
  }

  return parsed.length > 0 ? parsed : defaults;
}

function resolveAdditionalOptionGroups(raw: unknown): AdditionalOptionGroupDefinition[] {
  if (raw === undefined || raw === null) {
    return getDefaultCompanyWorkspace().additionalOptionGroups;
  }
  if (!Array.isArray(raw)) {
    return getDefaultCompanyWorkspace().additionalOptionGroups;
  }
  if (raw.length === 0) return [];

  const items = raw;

  const groups: AdditionalOptionGroupDefinition[] = [];
  const groupIds = new Set<string>();
  const optionKeys = new Set<string>();

  for (const item of items) {
    const record = asRecord(item);
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(id) || !title || groupIds.has(id)) continue;

    const options: AdditionalOptionGroupDefinition["options"] = [];
    for (const optionRaw of asArray(record.options)) {
      const option = asRecord(optionRaw);
      const key = typeof option.key === "string" ? option.key.trim() : "";
      const label = typeof option.label === "string" ? option.label.trim() : "";
      if (!/^[a-z][a-z0-9_]{1,62}$/.test(key) || key.startsWith("custom_") || !label || optionKeys.has(key)) {
        continue;
      }
      optionKeys.add(key);
      options.push({ key, label: label.slice(0, 200) });
      if (options.length >= 80) break;
    }

    groupIds.add(id);
    groups.push({ id, title: title.slice(0, 120), options });
    if (groups.length >= 20) break;
  }

  return groups.length > 0 ? groups : getDefaultCompanyWorkspace().additionalOptionGroups;
}

function resolveModules(raw: unknown): CompanyModules {
  const defaults = getDefaultCompanyWorkspace().modules;
  const record = asRecord(raw);
  const result = { ...defaults };
  for (const key of MODULE_KEYS) {
    if (typeof record[key] === "boolean") {
      result[key] = record[key];
    }
  }
  return result;
}

export interface CompanyWorkspaceRaw {
  stageLabels?: unknown;
  clientVisibleStages?: unknown;
  dealTabs?: unknown;
  dealFields?: unknown;
  customDealFields?: unknown;
  documentTypes?: unknown;
  additionalOptionGroups?: unknown;
  modules?: unknown;
}

export function resolveCompanyWorkspace(raw?: CompanyWorkspaceRaw | null): ResolvedCompanyWorkspace {
  if (!raw) return getDefaultCompanyWorkspace();
  return {
    stageLabels: resolveStageLabels(raw.stageLabels),
    clientVisibleStages: resolveClientVisibleStages(raw.clientVisibleStages),
    dealTabs: resolveDealTabs(raw.dealTabs),
    dealFields: resolveDealFields(raw.dealFields),
    customDealFields: resolveCustomDealFields(raw.customDealFields),
    documentTypes: resolveDocumentTypes(raw.documentTypes),
    additionalOptionGroups: resolveAdditionalOptionGroups(raw.additionalOptionGroups),
    modules: resolveModules(raw.modules),
  };
}
