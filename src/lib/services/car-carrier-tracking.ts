import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import {
  assertDealMediaAccess,
  deleteMedia,
  enrichMediaRecord,
  SEARCH_PROCESS_MEDIA_INCLUDE,
  uploadDealMedia,
} from "@/lib/services/media";

const pointInclude = {
  media: {
    orderBy: { uploadedAt: "asc" as const },
    include: SEARCH_PROCESS_MEDIA_INCLUDE,
  },
} as const;

async function serializePoint(point: {
  id: string;
  dealId: string;
  latitude: { toNumber(): number } | number;
  longitude: { toNumber(): number } | number;
  title: string;
  description: string;
  recordedAt: Date;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  media: Parameters<typeof enrichMediaRecord>[0][];
}) {
  const toNum = (value: { toNumber(): number } | number) =>
    typeof value === "number" ? value : value.toNumber();

  return {
    id: point.id,
    dealId: point.dealId,
    latitude: toNum(point.latitude),
    longitude: toNum(point.longitude),
    title: point.title,
    description: point.description,
    recordedAt: point.recordedAt.toISOString(),
    sortOrder: point.sortOrder,
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
    media: await Promise.all(point.media.map(enrichMediaRecord)),
  };
}

function serializeDestination(deal: {
  carCarrierDestinationLat: { toNumber(): number } | number | null;
  carCarrierDestinationLng: { toNumber(): number } | number | null;
  carCarrierDestinationTitle: string;
}) {
  if (deal.carCarrierDestinationLat == null || deal.carCarrierDestinationLng == null) {
    return null;
  }

  const toNum = (value: { toNumber(): number } | number) =>
    typeof value === "number" ? value : value.toNumber();

  return {
    latitude: toNum(deal.carCarrierDestinationLat),
    longitude: toNum(deal.carCarrierDestinationLng),
    title: deal.carCarrierDestinationTitle || "Точка назначения",
  };
}

export async function getCarCarrierTracking(user: AuthUser, dealId: string) {
  await assertDealMediaAccess(user, dealId);

  const [points, deal] = await Promise.all([
    prisma.carCarrierTrackingPoint.findMany({
      where: { dealId },
      orderBy: { sortOrder: "asc" },
      include: pointInclude,
    }),
    prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        carCarrierDestinationLat: true,
        carCarrierDestinationLng: true,
        carCarrierDestinationTitle: true,
      },
    }),
  ]);

  if (!deal) {
    throw new Error("Not found");
  }

  return {
    points: await Promise.all(points.map(serializePoint)),
    destination: serializeDestination(deal),
  };
}

export async function listCarCarrierTrackingPoints(user: AuthUser, dealId: string) {
  const data = await getCarCarrierTracking(user, dealId);
  return data.points;
}

export async function createCarCarrierTrackingPoint(
  user: AuthUser,
  dealId: string,
  input: {
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
    recordedAt?: Date;
  },
) {
  await assertDealMediaAccess(user, dealId, true);

  const last = await prisma.carCarrierTrackingPoint.findFirst({
    where: { dealId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const point = await prisma.carCarrierTrackingPoint.create({
    data: {
      dealId,
      latitude: input.latitude,
      longitude: input.longitude,
      title: input.title ?? "",
      description: input.description ?? "",
      recordedAt: input.recordedAt ?? new Date(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: pointInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "CarCarrierTrackingPoint",
    entityId: point.id,
    action: "CREATE",
    newValue: {
      dealId,
      latitude: input.latitude,
      longitude: input.longitude,
      title: point.title,
      sortOrder: point.sortOrder,
    },
  });

  return serializePoint(point);
}

export async function updateCarCarrierTrackingPoint(
  user: AuthUser,
  dealId: string,
  pointId: string,
  input: {
    latitude?: number;
    longitude?: number;
    title?: string;
    description?: string;
    recordedAt?: Date;
  },
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.carCarrierTrackingPoint.findFirst({
    where: { id: pointId, dealId },
  });

  if (!existing) {
    throw new Error("Not found");
  }

  const point = await prisma.carCarrierTrackingPoint.update({
    where: { id: pointId },
    data: {
      latitude: input.latitude,
      longitude: input.longitude,
      title: input.title,
      description: input.description,
      recordedAt: input.recordedAt,
    },
    include: pointInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "CarCarrierTrackingPoint",
    entityId: pointId,
    action: "UPDATE",
    newValue: { dealId, ...input },
  });

  return serializePoint(point);
}

export async function deleteCarCarrierTrackingPoint(
  user: AuthUser,
  dealId: string,
  pointId: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const point = await prisma.carCarrierTrackingPoint.findFirst({
    where: { id: pointId, dealId },
    include: { media: true },
  });

  if (!point) {
    throw new Error("Not found");
  }

  for (const item of point.media) {
    await deleteMedia(user, item.id);
  }

  await createAuditLog({
    userId: user.id,
    entity: "CarCarrierTrackingPoint",
    entityId: pointId,
    action: "DELETE",
    oldValue: { dealId, sortOrder: point.sortOrder },
  });

  await prisma.carCarrierTrackingPoint.delete({ where: { id: pointId } });
}

export async function uploadCarCarrierTrackingMedia(
  user: AuthUser,
  dealId: string,
  pointId: string,
  file: File,
) {
  return uploadDealMedia(user, dealId, file, { carCarrierTrackingPointId: pointId });
}

export async function setCarCarrierDestination(
  user: AuthUser,
  dealId: string,
  input: { latitude: number; longitude: number; title?: string },
) {
  await assertDealMediaAccess(user, dealId, true);

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: {
      carCarrierDestinationLat: input.latitude,
      carCarrierDestinationLng: input.longitude,
      carCarrierDestinationTitle: input.title ?? "Точка назначения",
    },
    select: {
      carCarrierDestinationLat: true,
      carCarrierDestinationLng: true,
      carCarrierDestinationTitle: true,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: dealId,
    action: "UPDATE",
    newValue: {
      carCarrierDestination: {
        latitude: input.latitude,
        longitude: input.longitude,
        title: input.title ?? "Точка назначения",
      },
    },
  });

  return serializeDestination(deal)!;
}

export async function clearCarCarrierDestination(user: AuthUser, dealId: string) {
  await assertDealMediaAccess(user, dealId, true);

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      carCarrierDestinationLat: null,
      carCarrierDestinationLng: null,
      carCarrierDestinationTitle: "",
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Deal",
    entityId: dealId,
    action: "UPDATE",
    newValue: { carCarrierDestination: null },
  });
}

export async function updateCarCarrierDestinationTitle(
  user: AuthUser,
  dealId: string,
  title: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      carCarrierDestinationLat: true,
      carCarrierDestinationLng: true,
      carCarrierDestinationTitle: true,
    },
  });

  if (
    !existing ||
    existing.carCarrierDestinationLat == null ||
    existing.carCarrierDestinationLng == null
  ) {
    throw new Error("Not found");
  }

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { carCarrierDestinationTitle: title },
    select: {
      carCarrierDestinationLat: true,
      carCarrierDestinationLng: true,
      carCarrierDestinationTitle: true,
    },
  });

  return serializeDestination(deal)!;
}
