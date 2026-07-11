import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES } from "@/lib/permissions";
import { DealManager } from "@/lib/types";

export const dealAccessSelect = {
  managerId: true,
  clientUserId: true,
  managerAssignments: { select: { managerId: true } },
} as const;

export const dealManagerSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const dealManagersInclude = {
  managerAssignments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      manager: { select: dealManagerSelect },
    },
  },
} as const;

export type DealWithManagerAssignments = {
  managerId: string | null;
  manager?: DealManager | null;
  managerIds?: string[];
  managers?: DealManager[];
  managerAssignments?: Array<{ managerId: string; manager?: DealManager }>;
};

export function normalizeManagerIds(managerIdOrIds?: string | null | string[]): string[] {
  if (Array.isArray(managerIdOrIds)) {
    return [...new Set(managerIdOrIds.filter(Boolean))];
  }
  return managerIdOrIds ? [managerIdOrIds] : [];
}

export function getDealManagerIds(deal: DealWithManagerAssignments): string[] {
  if (deal.managerIds?.length) {
    return deal.managerIds;
  }

  if (deal.managers?.length) {
    return deal.managers.map((manager) => manager.id);
  }

  if (deal.managerAssignments?.length) {
    return deal.managerAssignments.map((assignment) => assignment.managerId);
  }

  return deal.managerId ? [deal.managerId] : [];
}

export function getDealManagers(deal: DealWithManagerAssignments): DealManager[] {
  if (deal.managers?.length) {
    return deal.managers;
  }

  if (deal.managerAssignments?.length) {
    return deal.managerAssignments
      .map((assignment) => assignment.manager)
      .filter((manager): manager is DealManager => Boolean(manager));
  }

  return deal.manager ? [deal.manager] : [];
}

export function formatDealManagersLabel(deal: DealWithManagerAssignments, fallback = "Не назначен"): string {
  const managers = getDealManagers(deal);
  if (managers.length === 0) return fallback;
  return managers.map((manager) => manager.name).join(", ");
}

export function enrichDealWithManagers<T extends DealWithManagerAssignments>(deal: T) {
  const managers = getDealManagers(deal);
  const managerIds = managers.map((manager) => manager.id);

  return {
    ...deal,
    managers,
    managerIds,
    manager: managers[0] ?? null,
    managerId: managers[0]?.id ?? null,
  };
}

export async function assertValidManagerIds(managerIds: string[]) {
  if (managerIds.length === 0) return;

  const managers = await prisma.user.findMany({
    where: {
      id: { in: managerIds },
      role: { name: ROLES.MANAGER },
    },
    select: { id: true },
  });

  if (managers.length !== managerIds.length) {
    throw new Error("Один или несколько менеджеров не найдены");
  }
}

export async function syncDealManagerAssignments(
  tx: Prisma.TransactionClient,
  dealId: string,
  managerIds: string[],
) {
  const uniqueManagerIds = normalizeManagerIds(managerIds);

  await tx.dealManagerAssignment.deleteMany({ where: { dealId } });

  if (uniqueManagerIds.length > 0) {
    await tx.dealManagerAssignment.createMany({
      data: uniqueManagerIds.map((managerId) => ({ dealId, managerId })),
    });
  }

  await tx.deal.update({
    where: { id: dealId },
    data: { managerId: uniqueManagerIds[0] ?? null },
  });

  return uniqueManagerIds;
}

export async function resolveCreateManagerIds(
  user: AuthUser,
  inputManagerIds?: string[] | null,
  inputManagerId?: string | null,
): Promise<string[]> {
  const requestedIds = normalizeManagerIds(
    inputManagerIds ?? (inputManagerId ? [inputManagerId] : []),
  );

  if (user.role === ROLES.ADMIN) {
    await assertValidManagerIds(requestedIds);
    return requestedIds;
  }

  const managerIds = normalizeManagerIds([user.id, ...requestedIds]);
  await assertValidManagerIds(managerIds);
  return managerIds;
}

export async function resolveUpdateManagerIds(
  user: AuthUser,
  existingManagerIds: string[],
  inputManagerIds?: string[] | null,
  inputManagerId?: string | null,
): Promise<string[] | undefined> {
  const hasManagerIds = inputManagerIds !== undefined;
  const hasManagerId = inputManagerId !== undefined;

  if (!hasManagerIds && !hasManagerId) {
    return undefined;
  }

  if (user.role === ROLES.MANAGER && !existingManagerIds.includes(user.id)) {
    throw new Error("Недостаточно прав для изменения менеджеров");
  }

  if (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER) {
    throw new Error("Недостаточно прав для изменения менеджеров");
  }

  const nextManagerIds = hasManagerIds
    ? normalizeManagerIds(inputManagerIds)
    : normalizeManagerIds(inputManagerId);

  const current = normalizeManagerIds(existingManagerIds);
  if (
    nextManagerIds.length === current.length &&
    nextManagerIds.every((id, index) => id === current[index])
  ) {
    return undefined;
  }

  await assertValidManagerIds(nextManagerIds);
  return nextManagerIds;
}

export function buildDealManagerFilter(managerId: string): Prisma.DealWhereInput {
  return {
    managerAssignments: {
      some: { managerId },
    },
  };
}

export function buildDealManagersFilter(managerIds: string[]): Prisma.DealWhereInput {
  return {
    managerAssignments: {
      some: { managerId: { in: managerIds } },
    },
  };
}
