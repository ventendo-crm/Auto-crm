import { DealStageType, DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { notifyStageChange } from "@/lib/services/notifications";
import { recordStageChange } from "@/lib/services/stage-history";
import { z } from "zod";
import { createDealSchema, listDealsSchema, updateDealSchema } from "@/lib/validators/deal";

type CreateDealInput = z.infer<typeof createDealSchema>;
type UpdateDealInput = z.infer<typeof updateDealSchema>;
type ListDealsInput = z.infer<typeof listDealsSchema>;

const dealInclude = {
  manager: {
    select: { id: true, name: true, email: true },
  },
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
  clientUser: {
    select: { id: true, name: true, email: true, createdAt: true },
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

async function assertValidManagerId(managerId: string) {
  const manager = await prisma.user.findFirst({
    where: { id: managerId, role: { name: ROLES.MANAGER } },
    select: { id: true },
  });

  if (!manager) {
    throw new Error("Менеджер не найден");
  }
}

function resolveCreateManagerId(user: AuthUser, inputManagerId?: string): Promise<string> {
  if (user.role === ROLES.ADMIN) {
    if (!inputManagerId) {
      throw new Error("Укажите менеджера для сделки");
    }
    return assertValidManagerId(inputManagerId).then(() => inputManagerId);
  }

  return Promise.resolve(user.id);
}

async function resolveUpdateManagerId(
  user: AuthUser,
  existingManagerId: string,
  inputManagerId?: string,
): Promise<string | undefined> {
  if (inputManagerId === undefined) {
    return undefined;
  }

  if (inputManagerId === existingManagerId) {
    return undefined;
  }

  if (user.role !== ROLES.ADMIN) {
    throw new Error("Только администратор может переназначать менеджера");
  }

  await assertValidManagerId(inputManagerId);
  return inputManagerId;
}

function buildDealWhere(user: AuthUser, filters: ListDealsInput): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {};

  if (user.role === ROLES.CLIENT) {
    where.clientUserId = user.id;
  } else if (user.role === ROLES.MANAGER) {
    where.managerId = user.id;
  } else if (filters.managerId) {
    where.managerId = filters.managerId;
  }

  if (filters.stage) {
    where.currentStage = filters.stage;
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
  const where = buildDealWhere(user, filters);

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

  return { items, total, page: filters.page, limit: filters.limit };
}

export async function getDeal(id: string) {
  return prisma.deal.findUnique({
    where: { id },
    include: dealDetailInclude,
  });
}

export async function createDeal(user: AuthUser, input: CreateDealInput) {
  const managerId = await resolveCreateManagerId(user, input.managerId);
  const stage = input.currentStage ?? DealStageType.SEARCH;
  const now = new Date();

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        clientName: input.clientName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        vin: input.vin ?? "",
        carBrand: input.carBrand ?? null,
        carModel: input.carModel ?? null,
        carYear: input.carYear ?? null,
        purchasePrice: toDecimal(input.purchasePrice) ?? null,
        prepayment: toDecimal(input.prepayment) ?? null,
        balance: toDecimal(input.balance) ?? null,
        destinationCity: input.destinationCity,
        destinationCountry: input.destinationCountry,
        managerId,
        currentStage: stage,
        stageEnteredAt: now,
        expectedArrival: input.expectedArrival ?? null,
        actualArrival: input.actualArrival ?? null,
        priority: input.priority ?? 1,
      },
      include: dealInclude,
    });

    await tx.stageHistory.create({
      data: {
        dealId: created.id,
        fromStage: stage,
        toStage: stage,
        changedById: user.id,
      },
    });

    await tx.document.createMany({
      data: Object.values(DocumentType).map((type) => ({
        dealId: created.id,
        type,
        status: DocumentStatus.MISSING,
      })),
    });

    return created;
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: deal.id,
    action: "CREATE",
    newValue: { vin: deal.vin, clientName: deal.clientName, currentStage: deal.currentStage },
  });

  return deal;
}

export async function updateDeal(user: AuthUser, id: string, input: UpdateDealInput) {
  const existing = await getDeal(id);
  if (!existing) {
    throw new Error("Not found");
  }

  const managerId = await resolveUpdateManagerId(user, existing.managerId, input.managerId);

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      clientName: input.clientName,
      phone: input.phone,
      email: input.email,
      ...(input.vin !== undefined ? { vin: input.vin ?? "" } : {}),
      carBrand: input.carBrand,
      carModel: input.carModel,
      carYear: input.carYear,
      purchasePrice: toDecimal(input.purchasePrice),
      prepayment: toDecimal(input.prepayment),
      balance: toDecimal(input.balance),
      destinationCity: input.destinationCity,
      destinationCountry: input.destinationCountry,
      ...(managerId !== undefined ? { managerId } : {}),
      expectedArrival: input.expectedArrival,
      actualArrival: input.actualArrival,
      priority: input.priority,
    },
    include: dealInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: id,
    action: "UPDATE",
    oldValue: {
      clientName: existing.clientName,
      vin: existing.vin,
      managerId: existing.managerId,
    },
    newValue: {
      ...input,
      ...(managerId !== undefined ? { managerId } : {}),
    },
  });

  return deal;
}

export async function deleteDeal(user: AuthUser, id: string) {
  const existing = await getDeal(id);
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
}

export async function changeDealStage(user: AuthUser, id: string, toStage: DealStageType) {
  const existing = await getDeal(id);
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

    return [updated, stageRecord] as const;
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

  void notifyStageChange({
    dealId: id,
    clientName: deal.clientName,
    vin: deal.vin,
    fromStage,
    toStage,
    manager: {
      id: deal.manager.id,
      name: deal.manager.name,
    },
    changedBy: user,
  }).catch((error) => {
    console.error("[deals] notification failed after stage change:", error);
  });

  return { deal, history };
}
