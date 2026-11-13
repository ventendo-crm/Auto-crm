import { DealManager } from "@/lib/types";

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

export function formatDealManagersLabel(
  deal: DealWithManagerAssignments,
  fallback = "Не назначен",
): string {
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
