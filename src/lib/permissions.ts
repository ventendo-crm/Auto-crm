import { DealWithManagerAssignments, getDealManagerIds, normalizeManagerIds } from "@/lib/deal-managers";

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  VIEWER: "VIEWER",
  CLIENT: "CLIENT",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
}

export function isRoleName(value: string): value is RoleName {
  return (
    value === ROLES.ADMIN ||
    value === ROLES.MANAGER ||
    value === ROLES.VIEWER ||
    value === ROLES.CLIENT
  );
}

export function isStaffRole(role: RoleName): boolean {
  return role !== ROLES.CLIENT;
}

export function getDefaultRouteForRole(role: RoleName): string {
  return role === ROLES.CLIENT ? "/my-deal" : "/dashboard";
}

/** Client User may have role as object (from /me) or string (legacy login response). */
export type ClientUser = {
  id: string;
  role: RoleName | { id: string; name: string };
};

export function getClientRoleName(user: ClientUser | null | undefined): RoleName | null {
  if (!user) return null;

  const role = user.role;
  if (typeof role === "string") {
    return isRoleName(role) ? role : null;
  }

  return isRoleName(role.name) ? role.name : null;
}

function resolveManagerIds(
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): string[] {
  if (typeof managerIdOrIds === "object" && managerIdOrIds !== null && !Array.isArray(managerIdOrIds)) {
    return getDealManagerIds(managerIdOrIds);
  }
  return normalizeManagerIds(managerIdOrIds);
}

export function isAssignedDealManager(userId: string, managerIds: string[]): boolean {
  return managerIds.includes(userId);
}

export function canViewDeal(
  role: RoleName,
  userId: string,
  deal: DealWithManagerAssignments & { clientUserId?: string | null },
  managerPeerIds: readonly string[] = [],
): boolean {
  if (role === ROLES.ADMIN || role === ROLES.VIEWER) return true;
  if (role === ROLES.MANAGER) {
    const managerIds = getDealManagerIds(deal);
    if (managerIds.length === 0) return false;
    if (isAssignedDealManager(userId, managerIds)) return true;
    return managerIds.some((managerId) => managerPeerIds.includes(managerId));
  }
  if (role === ROLES.CLIENT) return deal.clientUserId === userId;
  return false;
}

export function canManageDealClient(
  user: ClientUser | null | undefined,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  const role = getClientRoleName(user);
  if (!user || !role) return false;
  return canUpdateDeal(role, user.id, managerIdOrIds);
}

export function canToggleAdditionalOption(
  role: RoleName,
  userId: string,
  deal: DealWithManagerAssignments & { clientUserId?: string | null },
): boolean {
  if (role === ROLES.CLIENT) {
    return deal.clientUserId === userId;
  }
  return canUpdateDeal(role, userId, deal);
}

export function canClearDealHistory(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.MANAGER) {
    const managerIds = resolveManagerIds(managerIdOrIds);
    return managerIds.length > 0 && isAssignedDealManager(userId, managerIds);
  }
  return false;
}

export function canCreateDeals(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canUpdateDeal(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  if (role === ROLES.CLIENT) return false;
  if (role === ROLES.ADMIN) return true;
  const managerIds = resolveManagerIds(managerIdOrIds);
  if (managerIds.length === 0) return false;
  if (role === ROLES.MANAGER) return isAssignedDealManager(userId, managerIds);
  return false;
}

export function canDeleteDeal(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canUpdateDeal(role, userId, managerIdOrIds);
}

export function canCreateComment(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canCommentOnDeal(
  role: RoleName,
  userId: string,
  deal: DealWithManagerAssignments & { clientUserId?: string | null },
): boolean {
  if (role === ROLES.CLIENT) {
    return deal.clientUserId === userId;
  }
  return canCreateComment(role);
}

export function canModifyComment(role: RoleName, userId: string, authorId: string): boolean {
  if (role === ROLES.CLIENT) return false;
  if (role === ROLES.ADMIN) return true;
  return userId === authorId;
}

export function canChangeStage(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canUpdateDeal(role, userId, managerIdOrIds);
}

export function canManageUsers(role: RoleName): boolean {
  return role === ROLES.ADMIN;
}

export function canManageManagers(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canViewAllDeals(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.VIEWER;
}

export function canUploadDealDocuments(
  role: RoleName,
  userId: string,
  deal: DealWithManagerAssignments & { clientUserId?: string | null },
): boolean {
  if (role === ROLES.CLIENT) {
    return deal.clientUserId === userId;
  }
  if (role === ROLES.MANAGER) {
    return isAssignedDealManager(userId, getDealManagerIds(deal));
  }
  return canViewDeal(role, userId, deal);
}

export function canDeleteDealDocuments(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canUpdateDeal(role, userId, managerIdOrIds);
}

export function canAssignDealManager(
  role: RoleName,
  userId?: string,
  deal?: DealWithManagerAssignments | null,
): boolean {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.MANAGER) {
    if (!userId) return true;
    if (!deal) return true;
    return isAssignedDealManager(userId, getDealManagerIds(deal));
  }
  return false;
}

export function canManageDealExpenses(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.MANAGER) {
    const managerIds = resolveManagerIds(managerIdOrIds);
    return managerIds.length > 0 && isAssignedDealManager(userId, managerIds);
  }
  return false;
}

export function canViewDealFinances(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canManageDealExpenses(role, userId, managerIdOrIds);
}

export function canManageDealReminders(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canManageDealExpenses(role, userId, managerIdOrIds);
}

export function canManageClientAccount(
  role: RoleName,
  userId: string,
  managerIdOrIds: string | null | string[] | DealWithManagerAssignments,
): boolean {
  return canUpdateDeal(role, userId, managerIdOrIds);
}
