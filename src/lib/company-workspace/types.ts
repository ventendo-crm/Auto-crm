import { DealStageType } from "@prisma/client";
import type { AdditionalOptionGroupDefinition } from "@/lib/additional-options";

export type BuiltInDealFieldKey = "vin" | "carYear" | "destinationCity";

export type DealTabKey = "importProcess" | "logistics" | "additionalOptions" | "searchProcess";

export type CompanyModuleKey = "catalog" | "calculator" | "carCarrier" | "googleCalendar";

export type DocumentGroup = "main" | "received";

export interface DealFieldSetting {
  enabled: boolean;
  required: boolean;
}

export interface CustomDealField {
  id: string;
  label: string;
  required: boolean;
  enabled: boolean;
}

export interface CompanyDocumentType {
  key: string;
  label: string;
  enabled: boolean;
  group: DocumentGroup;
  builtin: boolean;
}

export interface CompanyDealTabs {
  importProcess: boolean;
  logistics: boolean;
  additionalOptions: boolean;
  searchProcess: boolean;
}

export interface CompanyModules {
  catalog: boolean;
  calculator: boolean;
  carCarrier: boolean;
  googleCalendar: boolean;
}

export interface ResolvedCompanyWorkspace {
  stageLabels: Record<DealStageType, string>;
  clientVisibleStages: DealStageType[];
  dealTabs: CompanyDealTabs;
  dealFields: Record<BuiltInDealFieldKey, DealFieldSetting>;
  customDealFields: CustomDealField[];
  documentTypes: CompanyDocumentType[];
  additionalOptionGroups: AdditionalOptionGroupDefinition[];
  modules: CompanyModules;
}

export interface CompanyWorkspaceDto extends ResolvedCompanyWorkspace {
  companyId: string;
  updatedAt: string | null;
}
