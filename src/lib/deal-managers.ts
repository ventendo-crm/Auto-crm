import { Prisma } from "@prisma/client";
import { normalizeManagerIds } from "@/lib/deal-manager-list";
import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES } from "@/lib/permissions";

export {
  enrichDealWithManagers,
  formatDealManagersLabel,
  getDealManagerIds,
  getDealManagers,
  normalizeManagerIds,
  type DealWithManagerAssignments,
} from "@/lib/deal-manager-list";

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

export async function assertValidManagerIds(managerIds: string[], companyId: string) {
  if (managerIds.length === 0) return;

  const managers = await prisma.user.findMany({
    where: {
      id: { in: managerIds },
      companyId,
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
    await assertValidManagerIds(requestedIds, user.companyId);
    return requestedIds;
  }

  const managerIds = normalizeManagerIds([user.id, ...requestedIds]);
  await assertValidManagerIds(managerIds, user.companyId);
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

  await assertValidManagerIds(nextManagerIds, user.companyId);
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
