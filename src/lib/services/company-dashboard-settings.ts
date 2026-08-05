import { Prisma } from "@prisma/client";
import {
  DashboardLayoutItem,
  getDefaultDashboardLayout,
  normalizeDashboardLayout,
  sortDashboardLayout,
} from "@/lib/dashboard/widgets";
import { prisma } from "@/lib/prisma";

export interface CompanyDashboardSettingsDto {
  companyId: string;
  layout: DashboardLayoutItem[];
  updatedAt: string | null;
}

export async function ensureCompanyDashboardSettings(
  companyId: string,
): Promise<CompanyDashboardSettingsDto> {
  const existing = await prisma.companyDashboardSettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    const layout = sortDashboardLayout(normalizeDashboardLayout(existing.layout));
    const previousIds = new Set(
      Array.isArray(existing.layout)
        ? (existing.layout as Array<{ id?: string }>)
            .map((item) => item?.id)
            .filter((id): id is string => typeof id === "string")
        : [],
    );
    const mergedNew = layout.some((item) => !previousIds.has(item.id));

    if (mergedNew) {
      await prisma.companyDashboardSettings.update({
        where: { companyId },
        data: { layout: layout as unknown as Prisma.InputJsonValue },
      });
    }

    return {
      companyId,
      layout,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const defaults = getDefaultDashboardLayout();
  const created = await prisma.companyDashboardSettings.create({
    data: {
      companyId,
      layout: defaults as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    companyId,
    layout: defaults,
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function getCompanyDashboardLayout(
  companyId: string,
): Promise<CompanyDashboardSettingsDto> {
  return ensureCompanyDashboardSettings(companyId);
}

export async function saveCompanyDashboardLayout(
  companyId: string,
  layoutInput: DashboardLayoutItem[],
): Promise<CompanyDashboardSettingsDto> {
  const layout = sortDashboardLayout(normalizeDashboardLayout(layoutInput));

  const record = await prisma.companyDashboardSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      layout: layout as unknown as Prisma.InputJsonValue,
    },
    update: {
      layout: layout as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    companyId,
    layout,
    updatedAt: record.updatedAt.toISOString(),
  };
}
