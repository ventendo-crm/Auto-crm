import { DealStageType, DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  dealManagersInclude,
  enrichDealWithManagers,
  getDealManagerIds,
  getDealManagers,
  resolveCreateManagerIds,
  resolveUpdateManagerIds,
  syncDealManagerAssignments,
} from "@/lib/deal-managers";
import { AuthUser, ROLES } from "@/lib/permissions";
import { resolveOriginLabel } from "@/lib/customs-calculator/custom-origins";
import { getEnabledDocumentTypeKeys } from "@/lib/company-workspace/helpers";
import type { ResolvedCompanyWorkspace } from "@/lib/company-workspace/types";
import { createAuditLog } from "@/lib/services/audit";
import { getCompanyCalculatorSettings } from "@/lib/services/company-calculator-settings";
import { getCompanyWorkspaceSettings } from "@/lib/services/company-workspace";
import { buildManagerDealsWhere } from "@/lib/services/deal-access";
import { notifyStageChange } from "@/lib/services/notifications";
import { recordStageChange } from "@/lib/services/stage-history";
import { z } from "zod";
import { createDealSchema, listDealsSchema, updateDealSchema } from "@/lib/validators/deal";
import { scheduleDealRefresh, scheduleDealRemoval } from "@/lib/google-calendar/sync";

type CreateDealInput = z.infer<typeof createDealSchema>;
type UpdateDealInput = z.infer<typeof updateDealSchema>;
type ListDealsInput = z.infer<typeof listDealsSchema>;

const dealInclude = {
  manager: {
    select: { id: true, name: true, email: true },
  },
  ...dealManagersInclude,
  clientUser: {
    select: { id: true, name: true, email: true },
  },
  _count: {
    select: {
      comments: true,
      tasks: true,
      documents: true,
      reminders: true,
    },
  },
} as const;

const dealDetailInclude = {
  manager: {
    select: { id: true, name: true, email: true },
  },
  ...dealManagersInclude,
  clientUser: {
    select: { id: true, name: true, email: true, createdAt: true, telegramChatId: true },
  },
  documents: true,
  shipment: true,
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
    },
  },
  stageHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
  },
  media: {
    where: { searchProcessEntryId: null },
    orderBy: { uploadedAt: "desc" as const },
    take: 20,
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

function sanitizeCustomFields(
  settings: ResolvedCompanyWorkspace,
  input: Record<string, string> | undefined,
  mode: "create" | "update",
): Record<string, string> | undefined {
  if (mode === "update" && input === undefined) return undefined;
  const source = input ?? {};
  const result: Record<string, string> = {};
  for (const field of settings.customDealFields) {
    if (!field.enabled) continue;
    const value = (source[field.id] ?? "").trim();
    if (field.required && !value) {
      throw new Error(`Заполните поле «${field.label}»`);
    }
    if (value) result[field.id] = value.slice(0, 500);
  }
  return result;
}

function applyWorkspaceDealFields(
  settings: ResolvedCompanyWorkspace,
  input: {
    vin?: string | null;
    carYear?: number | null;
    destinationCity?: string;
    customFields?: Record<string, string>;
  },
  mode: "create" | "update",
): {
  vin?: string;
  carYear?: number | null;
  destinationCity?: string;
  customFields?: Record<string, string>;
} {
  const result: {
    vin?: string;
    carYear?: number | null;
    destinationCity?: string;
    customFields?: Record<string, string>;
  } = {};

  if (settings.dealFields.vin.enabled && (mode === "create" || input.vin !== undefined)) {
    const vin = (input.vin ?? "").trim();
    if (settings.dealFields.vin.required && !vin) {
      throw new Error("Укажите VIN");
    }
    result.vin = vin;
  } else if (mode === "create") {
    result.vin = "";
  }

  if (settings.dealFields.carYear.enabled && (mode === "create" || input.carYear !== undefined)) {
    const carYear = input.carYear ?? null;
    if (settings.dealFields.carYear.required && carYear == null) {
      throw new Error("Укажите год автомобиля");
    }
    result.carYear = carYear;
  } else if (mode === "create") {
    result.carYear = null;
  }

  if (
    settings.dealFields.destinationCity.enabled &&
    (mode === "create" || input.destinationCity !== undefined)
  ) {
    const destinationCity = (input.destinationCity ?? "").trim();
    if (settings.dealFields.destinationCity.required && destinationCity.length < 2) {
      throw new Error("Укажите город экспорта");
    }
    result.destinationCity = destinationCity;
  } else if (mode === "create") {
    result.destinationCity = "";
  }

  result.customFields = sanitizeCustomFields(settings, input.customFields, mode);
  return result;
}

async function buildDealWhere(user: AuthUser, filters: ListDealsInput): Promise<Prisma.DealWhereInput> {
  const where: Prisma.DealWhereInput = {
    companyId: user.companyId,
  };

  if (user.role === ROLES.CLIENT) {
    where.clientUserId = user.id;
  } else if (user.role === ROLES.MANAGER) {
    Object.assign(where, await buildManagerDealsWhere(user, filters.managerId));
  } else if (filters.managerId) {
    Object.assign(where, { managerAssignments: { some: { managerId: filters.managerId } } });
  }

  if (filters.stage) {
    where.currentStage = filters.stage;
  }

  if (filters.destinationCountry) {
    const settings = await getCompanyCalculatorSettings(user.companyId);
    const label = resolveOriginLabel(
      filters.destinationCountry,
      settings.customOrigins,
    );
    const values = Array.from(new Set([filters.destinationCountry, label]));
    where.destinationCountry = { in: values };
  }

  if (filters.search) {
    where.OR = [
      { clientName: { contains: filters.search, mode: "insensitive" } },
      { vin: { contains: filters.search, mode: "insensitive" } },
      { carBrand: { contains: filters.search, mode: "insensitive" } },
      { carModel: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listDeals(user: AuthUser, filters: ListDealsInput) {
  const where = await buildDealWhere(user, filters);

  const [items, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: dealInclude,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.deal.count({ where }),
  ]);

  return {
    items: items.map((item) => enrichDealWithManagers(item)),
    total,
    page: filters.page,
    limit: filters.limit,
  };
}

export async function getDeal(id: string, companyId: string) {
  const deal = await prisma.deal.findFirst({
    where: {
      id,
      companyId,
    },
    include: dealDetailInclude,
  });

  return deal ? enrichDealWithManagers(deal) : null;
}

export async function createDeal(user: AuthUser, input: CreateDealInput) {
  const managerIds = await resolveCreateManagerIds(user, input.managerIds, input.managerId);
  const stage = input.currentStage ?? DealStageType.LEADS;
  const now = new Date();
  const workspace = await getCompanyWorkspaceSettings(user.companyId);
  const fields = applyWorkspaceDealFields(workspace, input, "create");
  const documentTypes = getEnabledDocumentTypeKeys(workspace.documentTypes);

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        companyId: user.companyId,
        clientName: input.clientName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        vin: fields.vin ?? "",
        carBrand: input.carBrand ?? null,
        carModel: input.carModel ?? null,
        carYear: fields.carYear ?? null,
        purchasePrice: toDecimal(input.purchasePrice) ?? null,
        prepayment: toDecimal(input.prepayment) ?? null,
        balance: toDecimal(input.balance) ?? null,
        destinationCity: fields.destinationCity ?? "",
        destinationCountry: input.destinationCountry,
        customFields: (fields.customFields ?? {}) as Prisma.InputJsonValue,
        managerId: managerIds[0] ?? null,
        currentStage: stage,
        stageEnteredAt: now,
        expectedArrival: input.expectedArrival ?? null,
        actualArrival: input.actualArrival ?? null,
        priority: input.priority ?? 1,
        importProcessEnabled: workspace.dealTabs.importProcess,
      },
      include: dealInclude,
    });

    if (managerIds.length > 0) {
      await syncDealManagerAssignments(tx, created.id, managerIds);
    }

    await tx.stageHistory.create({
      data: {
        dealId: created.id,
        fromStage: stage,
        toStage: stage,
        changedById: user.id,
      },
    });

    await tx.document.createMany({
      data: documentTypes.map((type) => ({
        dealId: created.id,
        type,
        status: DocumentStatus.MISSING,
      })),
    });

    const refreshed = await tx.deal.findUniqueOrThrow({
      where: { id: created.id },
      include: dealInclude,
    });

    return enrichDealWithManagers(refreshed);
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: deal.id,
    action: "CREATE",
    newValue: {
      vin: deal.vin,
      clientName: deal.clientName,
      currentStage: deal.currentStage,
      managerIds: deal.managerIds,
    },
  });

  return deal;
}

export async function updateDeal(user: AuthUser, id: string, input: UpdateDealInput) {
  const existing = await getDeal(id, user.companyId);
  if (!existing) {
    throw new Error("Not found");
  }

  const managerIds = await resolveUpdateManagerIds(
    user,
    getDealManagerIds(existing),
    input.managerIds,
    input.managerId,
  );

  const workspace = await getCompanyWorkspaceSettings(user.companyId);
  const fields = applyWorkspaceDealFields(workspace, input, "update");

  const deal = await prisma.$transaction(async (tx) => {
    if (managerIds !== undefined) {
      await syncDealManagerAssignments(tx, id, managerIds);
    }

    const updated = await tx.deal.update({
      where: { id },
      data: {
        clientName: input.clientName,
        phone: input.phone,
        email: input.email,
        ...(fields.vin !== undefined ? { vin: fields.vin } : {}),
        carBrand: input.carBrand,
        carModel: input.carModel,
        ...(fields.carYear !== undefined ? { carYear: fields.carYear } : {}),
        purchasePrice: toDecimal(input.purchasePrice),
        prepayment: toDecimal(input.prepayment),
        balance: toDecimal(input.balance),
        ...(fields.destinationCity !== undefined ? { destinationCity: fields.destinationCity } : {}),
        destinationCountry: input.destinationCountry,
        ...(fields.customFields !== undefined
          ? { customFields: fields.customFields as Prisma.InputJsonValue }
          : {}),
        expectedArrival: input.expectedArrival,
        actualArrival: input.actualArrival,
        priority: input.priority,
      },
      include: dealInclude,
    });

    return enrichDealWithManagers(updated);
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: id,
    action: "UPDATE",
    oldValue: {
      clientName: existing.clientName,
      vin: existing.vin,
      managerIds: getDealManagerIds(existing),
    },
    newValue: {
      ...input,
      ...(managerIds !== undefined ? { managerIds } : {}),
    },
  });

  scheduleDealRefresh(id);

  return deal;
}

export async function deleteDeal(user: AuthUser, id: string) {
  const existing = await getDeal(id, user.companyId);
  if (!existing) {
    throw new Error("Not found");
  }

  await prisma.deal.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: id,
    action: "DELETE",
    oldValue: { vin: existing.vin, clientName: existing.clientName },
  });

  scheduleDealRemoval(user.companyId, id);
}

export async function changeDealStage(user: AuthUser, id: string, toStage: DealStageType) {
  const existing = await getDeal(id, user.companyId);
  if (!existing) {
    throw new Error("Not found");
  }

  if (existing.currentStage === toStage) {
    return { deal: existing, history: null };
  }

  const now = new Date();
  const fromStage = existing.currentStage;

  const [deal, history] = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: {
        currentStage: toStage,
        stageEnteredAt: now,
      },
      include: dealInclude,
    });

    const stageRecord = await tx.stageHistory.create({
      data: {
        dealId: id,
        fromStage,
        toStage,
        changedById: user.id,
      },
      include: {
        changedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return [enrichDealWithManagers(updated), stageRecord] as const;
  });

  try {
    await createAuditLog({
      userId: user.id,
      entity: "Deal",
      entityId: id,
      action: "STAGE_CHANGE",
      oldValue: { currentStage: fromStage },
      newValue: { currentStage: toStage },
    });
  } catch (error) {
    console.error("[deals] audit log failed after stage change:", error);
  }

  try {
    await notifyStageChange({
      dealId: id,
      clientName: deal.clientName,
      vin: deal.vin,
      carBrand: deal.carBrand,
      carModel: deal.carModel,
      clientUserId: deal.clientUserId,
      fromStage,
      toStage,
      managers: getDealManagers(deal),
      changedBy: user,
    });
  } catch (error) {
    console.error("[deals] notification failed after stage change:", error);
  }

  return { deal, history };
}
