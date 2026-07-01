import { Prisma } from "@prisma/client";
import { AuthUser, ROLES, canViewDeal } from "@/lib/permissions";
import {
  getManagerPeerIds,
  getManagerVisibleManagerIds,
} from "@/lib/services/manager-links";

export async function getManagerPeerIdsForUser(user: AuthUser): Promise<string[]> {
  if (user.role !== ROLES.MANAGER) {
    return [];
  }
  return getManagerPeerIds(user.id);
}

export async function canUserViewDeal(
  user: AuthUser,
  deal: { managerId: string | null; clientUserId?: string | null },
): Promise<boolean> {
  const peerIds = await getManagerPeerIdsForUser(user);
  return canViewDeal(user.role, user.id, deal, peerIds);
}

export async function buildManagerDealsWhere(
  user: AuthUser,
  managerIdFilter?: string,
): Promise<Prisma.DealWhereInput> {
  const visibleManagerIds = await getManagerVisibleManagerIds(user.id);

  if (managerIdFilter) {
    if (!visibleManagerIds.includes(managerIdFilter)) {
      return { managerId: { in: [] } };
    }
    return { managerId: managerIdFilter };
  }

  return { managerId: { in: visibleManagerIds } };
}
