import { AuthUser, canUpdateDeal, canViewDeal } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getManagerPeerIdsForUser } from "@/lib/services/deal-access";
import {
  shipmentInputToData,
  UpdateShipmentInput,
} from "@/lib/validators/shipment";

async function assertDealShipmentAccess(user: AuthUser, dealId: string, write = false) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { managerId: true, clientUserId: true },
  });

  if (!deal) {
    throw new Error("Not found");
  }

  if (write) {
    if (!canUpdateDeal(user.role, user.id, deal.managerId)) {
      throw new Error("Forbidden");
    }
  } else {
    const peerIds = await getManagerPeerIdsForUser(user);
    if (!canViewDeal(user.role, user.id, deal, peerIds)) {
      throw new Error("Forbidden");
    }
  }

  return deal;
}

export async function getDealShipment(user: AuthUser, dealId: string) {
  await assertDealShipmentAccess(user, dealId);

  return prisma.shipment.findUnique({
    where: { dealId },
  });
}

export async function upsertDealShipment(
  user: AuthUser,
  dealId: string,
  input: UpdateShipmentInput,
) {
  await assertDealShipmentAccess(user, dealId, true);

  const data = shipmentInputToData(input);
  const existing = await prisma.shipment.findUnique({ where: { dealId } });

  const shipment = await prisma.shipment.upsert({
    where: { dealId },
    create: { dealId, ...data },
    update: data,
  });

  await createAuditLog({
    userId: user.id,
    entity: "Shipment",
    entityId: shipment.id,
    action: existing ? "UPDATE" : "CREATE",
    oldValue: existing ?? undefined,
    newValue: data,
  });

  return shipment;
}
