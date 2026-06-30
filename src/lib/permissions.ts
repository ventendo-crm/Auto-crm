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

export function canViewDeal(
  role: RoleName,
  userId: string,
  deal: { managerId: string | null; clientUserId?: string | null },
): boolean {
  if (role === ROLES.ADMIN || role === ROLES.VIEWER) return true;
  if (role === ROLES.MANAGER) return deal.managerId !== null && userId === deal.managerId;
  if (role === ROLES.CLIENT) return deal.clientUserId === userId;
  return false;
}

export function canManageDealClient(
  user: ClientUser | null | undefined,
  managerId: string | null,
): boolean {
  const role = getClientRoleName(user);
  if (!user || !role) return false;
  return canUpdateDeal(role, user.id, managerId);
}

export function canCreateDeals(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canUpdateDeal(role: RoleName, userId: string, managerId: string | null): boolean {
  if (role === ROLES.CLIENT) return false;
  if (role === ROLES.ADMIN) return true;
  if (!managerId) return false;
  if (role === ROLES.MANAGER) return userId === managerId;
  return false;
}

export function canDeleteDeal(role: RoleName, userId: string, managerId: string | null): boolean {
  if (role === ROLES.CLIENT) return false;
  if (role === ROLES.ADMIN) return true;
  if (!managerId) return false;
  if (role === ROLES.MANAGER) return userId === managerId;
  return false;
}

export function canCreateComment(role: RoleName): boolean {
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

export function canCommentOnDeal(
  role: RoleName,
  userId: string,
  deal: { managerId: string | null; clientUserId?: string | null },
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

export function canChangeStage(role: RoleName, userId: string, managerId: string | null): boolean {
  return canUpdateDeal(role, userId, managerId);
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
  deal: { managerId: string | null; clientUserId?: string | null },
): boolean {
  return canViewDeal(role, userId, deal);
}

export function canAssignDealManager(role: RoleName): boolean {
  return role === ROLES.ADMIN;
}

export function canManageDealExpenses(
  role: RoleName,
  userId: string,
  managerId: string | null,
): boolean {
  if (role === ROLES.ADMIN) return true;
  if (role === ROLES.MANAGER) return managerId !== null && userId === managerId;
  return false;
}

export function canViewDealFinances(
  role: RoleName,
  userId: string,
  managerId: string | null,
): boolean {
  return canManageDealExpenses(role, userId, managerId);
}

export function canManageDealReminders(
  role: RoleName,
  userId: string,
  managerId: string | null,
): boolean {
  return canManageDealExpenses(role, userId, managerId);
}

export function canManageClientAccount(role: RoleName, userId: string, managerId: string | null): boolean {
  return canUpdateDeal(role, userId, managerId);
}
