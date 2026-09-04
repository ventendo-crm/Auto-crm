import { DealStageType } from "@prisma/client";
import { ADDITIONAL_OPTION_GROUPS } from "@/lib/additional-options";
import {
  CLIENT_DOCUMENT_ORDER,
  DOCUMENT_LABELS,
  RECEIVED_DOCUMENT_ORDER,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/lib/constants";
import { CATALOG_ENABLED } from "@/lib/features";
import type {
  CompanyDocumentType,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";
import { COMPANION_DOCUMENT_PARENT } from "@/lib/company-workspace/helpers";

export function getDefaultDocumentTypes(): CompanyDocumentType[] {
  const main = CLIENT_DOCUMENT_ORDER.filter((key) => !(key in COMPANION_DOCUMENT_PARENT)).map(
    (key) => ({
      key,
      label: DOCUMENT_LABELS[key],
      enabled: true,
      group: "main" as const,
      builtin: true,
    }),
  );
  const received = RECEIVED_DOCUMENT_ORDER.map((key) => ({
    key,
    label: DOCUMENT_LABELS[key],
    enabled: true,
    group: "received" as const,
    builtin: true,
  }));
  return [...main, ...received];
}

export function getDefaultCompanyWorkspace(): ResolvedCompanyWorkspace {
  return {
    stageLabels: { ...STAGE_LABELS },
    clientVisibleStages: [...STAGE_ORDER],
    dealTabs: {
      importProcess: false,
      logistics: true,
      additionalOptions: true,
      searchProcess: true,
    },
    dealFields: {
      vin: { enabled: true, required: false },
      carYear: { enabled: true, required: false },
      destinationCity: { enabled: true, required: true },
    },
    customDealFields: [],
    documentTypes: getDefaultDocumentTypes(),
    additionalOptionGroups: ADDITIONAL_OPTION_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      options: group.options.map((option) => ({ key: option.key, label: option.label })),
    })),
    modules: {
      catalog: CATALOG_ENABLED,
      calculator: true,
      carCarrier: true,
      googleCalendar: true,
    },
  };
}

export function defaultStageLabel(stage: DealStageType): string {
  return STAGE_LABELS[stage];
}
