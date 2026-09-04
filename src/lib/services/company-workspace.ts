import { Prisma } from "@prisma/client";
import { DealStageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AuthUser,
  canAccessCalculator,
  canAccessCatalog,
  canManageCompanyCalculator,
  canManageCompanyGoogleCalendar,
} from "@/lib/permissions";
import { resolveCompanyWorkspace } from "@/lib/company-workspace/resolve";
import type {
  CompanyModuleKey,
  CompanyWorkspaceDto,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";
import type { CompanyWorkspacePutInput } from "@/lib/validators/company-workspace";

function toDto(
  companyId: string,
  settings: ResolvedCompanyWorkspace,
  updatedAt: Date | null,
): CompanyWorkspaceDto {
  return {
    companyId,
    updatedAt: updatedAt?.toISOString() ?? null,
    ...settings,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function ensureCompanyWorkspaceSettings(
  companyId: string,
): Promise<CompanyWorkspaceDto> {
  const existing = await prisma.companyWorkspaceSettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    return toDto(companyId, resolveCompanyWorkspace(existing), existing.updatedAt);
  }

  const resolved = resolveCompanyWorkspace(null);
  const created = await prisma.companyWorkspaceSettings.create({
    data: {
      companyId,
      stageLabels: toJson(resolved.stageLabels),
      clientVisibleStages: toJson(resolved.clientVisibleStages),
      dealTabs: toJson(resolved.dealTabs),
      dealFields: toJson(resolved.dealFields),
      customDealFields: toJson(resolved.customDealFields),
      documentTypes: toJson(resolved.documentTypes),
      additionalOptionGroups: toJson(resolved.additionalOptionGroups),
      modules: toJson(resolved.modules),
    },
  });

  return toDto(companyId, resolved, created.updatedAt);
}

export async function getCompanyWorkspaceSettings(
  companyId: string,
): Promise<ResolvedCompanyWorkspace> {
  const dto = await ensureCompanyWorkspaceSettings(companyId);
  const { companyId: _id, updatedAt: _updated, ...settings } = dto;
  return settings;
}

export async function getCompanyStageLabels(
  companyId: string,
): Promise<Record<DealStageType, string>> {
  const settings = await getCompanyWorkspaceSettings(companyId);
  return settings.stageLabels;
}

export async function isCompanyModuleEnabled(
  companyId: string,
  module: CompanyModuleKey,
): Promise<boolean> {
  const settings = await getCompanyWorkspaceSettings(companyId);
  return settings.modules[module];
}

export async function assertCompanyCatalogAccess(user: AuthUser) {
  const enabled = await isCompanyModuleEnabled(user.companyId, "catalog");
  if (!canAccessCatalog(user.role, enabled)) {
    throw new Error("Forbidden");
  }
}

export async function assertCompanyCalculatorAccess(user: AuthUser) {
  const enabled = await isCompanyModuleEnabled(user.companyId, "calculator");
  if (!canAccessCalculator(user.role, enabled)) {
    throw new Error("Forbidden");
  }
}

export async function assertCompanyGoogleCalendarAccess(user: AuthUser) {
  if (!canManageCompanyGoogleCalendar(user.role)) {
    throw new Error("Forbidden");
  }
  if (!(await isCompanyModuleEnabled(user.companyId, "googleCalendar"))) {
    throw new Error("Forbidden");
  }
}

export async function assertCompanyCalculatorManageAccess(user: AuthUser) {
  if (!canManageCompanyCalculator(user.role)) {
    throw new Error("Forbidden");
  }
  if (!(await isCompanyModuleEnabled(user.companyId, "calculator"))) {
    throw new Error("Forbidden");
  }
}

export async function saveCompanyWorkspaceSettings(
  companyId: string,
  input: CompanyWorkspacePutInput,
): Promise<CompanyWorkspaceDto> {
  const current = await ensureCompanyWorkspaceSettings(companyId);
  const resolved = resolveCompanyWorkspace({
    stageLabels: input.stageLabels ?? current.stageLabels,
    clientVisibleStages: input.clientVisibleStages ?? current.clientVisibleStages,
    dealTabs: { ...current.dealTabs, ...input.dealTabs },
    dealFields: { ...current.dealFields, ...input.dealFields },
    customDealFields: input.customDealFields ?? current.customDealFields,
    documentTypes: input.documentTypes ?? current.documentTypes,
    additionalOptionGroups: input.additionalOptionGroups ?? current.additionalOptionGroups,
    modules: { ...current.modules, ...input.modules },
  });

  const record = await prisma.companyWorkspaceSettings.update({
    where: { companyId },
    data: {
      stageLabels: toJson(resolved.stageLabels),
      clientVisibleStages: toJson(resolved.clientVisibleStages),
      dealTabs: toJson(resolved.dealTabs),
      dealFields: toJson(resolved.dealFields),
      customDealFields: toJson(resolved.customDealFields),
      documentTypes: toJson(resolved.documentTypes),
      additionalOptionGroups: toJson(resolved.additionalOptionGroups),
      modules: toJson(resolved.modules),
    },
  });

  return toDto(companyId, resolved, record.updatedAt);
}
