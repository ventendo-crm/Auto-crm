import { dealManagersInclude, enrichDealWithManagers } from "@/lib/deal-managers";
import { hashPassword } from "@/lib/auth";
import { DOCUMENT_LABELS, STAGE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { enrichMediaRecord, SEARCH_PROCESS_MEDIA_INCLUDE } from "@/lib/services/media";
import { getRoleByName, ensureDefaultRoles } from "@/lib/services/roles";
import { deleteUser } from "@/lib/services/users";
import { serialize } from "@/lib/serialize";

const clientUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} as const;

const galleryMediaInclude = {
  uploadedBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

export async function getDealByClientUserId(clientUserId: string) {
  return prisma.deal.findFirst({
    where: { clientUserId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      ...dealManagersInclude,
      clientUser: { select: clientUserSelect },
      documents: true,
      shipment: true,
      comments: {
        orderBy: { createdAt: "asc" as const },
        include: {
          author: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        },
      },
      searchProcessEntries: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          media: {
            orderBy: { uploadedAt: "asc" as const },
            include: SEARCH_PROCESS_MEDIA_INCLUDE,
          },
        },
      },
      importProcessEntries: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          media: {
            orderBy: { uploadedAt: "asc" as const },
            include: SEARCH_PROCESS_MEDIA_INCLUDE,
          },
        },
      },
      carCarrierTrackingPoints: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          media: {
            orderBy: { uploadedAt: "asc" as const },
            include: SEARCH_PROCESS_MEDIA_INCLUDE,
          },
        },
      },
      media: {
        where: {
          searchProcessEntryId: null,
          importProcessEntryId: null,
          carCarrierTrackingPointId: null,
        },
        orderBy: { uploadedAt: "desc" as const },
        include: galleryMediaInclude,
      },
      stageHistory: {
        orderBy: { createdAt: "desc" as const },
        take: 20,
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function getClientPortalDeal(clientUserId: string) {
  const deal = await getDealByClientUserId(clientUserId);
  if (!deal) return null;

  const enrichedDeal = enrichDealWithManagers(deal);

  const searchProcess = await Promise.all(
    deal.searchProcessEntries.map(async (entry) => ({
      id: entry.id,
      description: entry.description,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
      clientFeedback: entry.clientFeedback,
      clientFeedbackAt: entry.clientFeedbackAt,
      media: await Promise.all(entry.media.map(enrichMediaRecord)),
    })),
  );

  const importProcess = await Promise.all(
    deal.importProcessEntries.map(async (entry) => ({
      id: entry.id,
      description: entry.description,
      sortOrder: entry.sortOrder,
      stageNumber: entry.sortOrder + 1,
      media: await Promise.all(entry.media.map(enrichMediaRecord)),
    })),
  );

  const carCarrierTracking = await Promise.all(
    deal.carCarrierTrackingPoints.map(async (point) => ({
      id: point.id,
      dealId: deal.id,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      title: point.title,
      description: point.description,
      recordedAt: point.recordedAt.toISOString(),
      sortOrder: point.sortOrder,
      createdAt: point.createdAt.toISOString(),
      updatedAt: point.updatedAt.toISOString(),
      media: await Promise.all(point.media.map(enrichMediaRecord)),
    })),
  );

  const carCarrierDestination =
    deal.carCarrierDestinationLat != null && deal.carCarrierDestinationLng != null
      ? {
          latitude: Number(deal.carCarrierDestinationLat),
          longitude: Number(deal.carCarrierDestinationLng),
          title: deal.carCarrierDestinationTitle || "Точка назначения",
        }
      : null;

  const media = await Promise.all(deal.media.map(enrichMediaRecord));

  return serialize({
    id: deal.id,
    clientName: deal.clientName,
    vin: deal.vin,
    carBrand: deal.carBrand,
    carModel: deal.carModel,
    carYear: deal.carYear,
    destinationCity: deal.destinationCity,
    destinationCountry: deal.destinationCountry,
    currentStage: deal.currentStage,
    stageLabel: STAGE_LABELS[deal.currentStage],
    expectedArrival: deal.expectedArrival,
    actualArrival: deal.actualArrival,
    managerId: enrichedDeal.managerId,
    manager: enrichedDeal.manager,
    managers: enrichedDeal.managers,
    managerIds: enrichedDeal.managerIds,
    documents: deal.documents.map((doc) => ({
      id: doc.id,
      dealId: deal.id,
      type: doc.type,
      label: DOCUMENT_LABELS[doc.type as keyof typeof DOCUMENT_LABELS] ?? doc.type,
      status: doc.status,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt,
    })),
    shipment: deal.shipment,
    stageHistory: deal.stageHistory.map((item) => ({
      id: item.id,
      fromStage: item.fromStage,
      toStage: item.toStage,
      fromLabel: STAGE_LABELS[item.fromStage],
      toLabel: STAGE_LABELS[item.toStage],
      createdAt: item.createdAt,
    })),
    comments: deal.comments.map((comment) => ({
      id: comment.id,
      dealId: deal.id,
      text: comment.text,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
      author: comment.author,
    })),
    searchProcess,
    searchProcessLinks: {
      inspectionLink: deal.inspectionLink,
      chinaAutotecaLink: deal.chinaAutotecaLink,
    },
    importProcessEnabled: deal.importProcessEnabled,
    importProcess,
    carCarrierTracking,
    carCarrierDestination,
    media,
  });
}

export async function createClientAccount(
  actor: AuthUser,
  dealId: string,
  input: { name: string; email: string; password: string },
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, clientUserId: true, clientName: true },
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  if (deal.clientUserId) {
    throw new Error("CLIENT_ALREADY_LINKED");
  }

  await ensureDefaultRoles();

  const role = await getRoleByName("CLIENT");
  if (!role) {
    throw new Error("CLIENT_ROLE_NOT_FOUND");
  }

  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        roleId: role.id,
      },
      select: clientUserSelect,
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { clientUserId: created.id },
    });

    return created;
  });

  await createAuditLog({
    userId: actor.id,
    entity: "User",
    entityId: user.id,
    action: "CREATE",
    newValue: { email: user.email, role: "CLIENT", dealId },
  });

  return user;
}

export async function unlinkClientAccount(actor: AuthUser, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, clientUserId: true },
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  if (!deal.clientUserId) {
    throw new Error("CLIENT_NOT_LINKED");
  }

  await deleteUser({ actorId: actor.id, userId: deal.clientUserId });
}
