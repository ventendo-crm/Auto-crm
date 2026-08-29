import { Prisma } from "@prisma/client";
import {
  buildPublicSelectionUrl,
  createShareToken,
  hashShareToken,
} from "@/lib/catalog/share-token";
import { AuthUser, canAccessCatalog } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { serializeGalleryUrls } from "@/lib/services/catalog-serialize";
import {
  addSelectionItemSchema,
  createCatalogSelectionSchema,
  createShareTokenSchema,
  updateCatalogSelectionSchema,
} from "@/lib/validators/catalog";
import { z } from "zod";

type CreateInput = z.infer<typeof createCatalogSelectionSchema>;
type UpdateInput = z.infer<typeof updateCatalogSelectionSchema>;
type AddItemInput = z.infer<typeof addSelectionItemSchema>;
type ShareInput = z.infer<typeof createShareTokenSchema>;

function assertCatalogAccess(user: AuthUser) {
  if (!canAccessCatalog(user.role)) {
    throw new Error("Forbidden");
  }
}

const selectionInclude = {
  createdBy: { select: { id: true, name: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      catalogVehicle: {
        include: {
          customsEstimate: true,
        },
      },
    },
  },
  shareTokens: {
    orderBy: { createdAt: "desc" as const },
    include: { createdBy: { select: { name: true } } },
  },
} as const;

function serializeSelectionItem(item: {
  id: string;
  sortOrder: number;
  note: string;
  catalogVehicle: {
    id: string;
    titleRu: string;
    titleZh: string;
    brand: string | null;
    model: string | null;
    carYear: number | null;
    mileageKm: number | null;
    priceCny: Prisma.Decimal | null;
    coverImageUrl: string | null;
    galleryUrls: Prisma.JsonValue;
    descriptionRu: string;
    videoUrl: string | null;
    customsEstimate: {
      totalWithCar: Prisma.Decimal;
      result: Prisma.JsonValue;
      input: Prisma.JsonValue;
    } | null;
  };
}) {
  const vehicle = item.catalogVehicle;
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    note: item.note,
    vehicle: {
      id: vehicle.id,
      titleRu: vehicle.titleRu,
      titleZh: vehicle.titleZh,
      brand: vehicle.brand,
      model: vehicle.model,
      carYear: vehicle.carYear,
      mileageKm: vehicle.mileageKm,
      priceCny: vehicle.priceCny != null ? Number(vehicle.priceCny) : null,
      coverImageUrl: vehicle.coverImageUrl,
      galleryUrls: serializeGalleryUrls(vehicle.galleryUrls),
      descriptionRu: vehicle.descriptionRu,
      videoUrl: vehicle.videoUrl,
      estimateTotal: vehicle.customsEstimate
        ? Number(vehicle.customsEstimate.totalWithCar)
        : null,
      estimateResult: vehicle.customsEstimate?.result ?? null,
      estimateInput: vehicle.customsEstimate?.input ?? null,
    },
  };
}

function serializeSelection(record: {
  id: string;
  companyId: string;
  dealId: string | null;
  title: string;
  note: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string };
  items: Parameters<typeof serializeSelectionItem>[0][];
  shareTokens: Array<{
    id: string;
    label: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    viewCount: number;
    lastViewedAt: Date | null;
    createdAt: Date;
    createdBy: { name: string };
  }>;
}) {
  return {
    id: record.id,
    companyId: record.companyId,
    dealId: record.dealId,
    title: record.title,
    note: record.note,
    createdById: record.createdById,
    createdByName: record.createdBy.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: record.items.map(serializeSelectionItem),
    shareTokens: record.shareTokens.map((token) => ({
      id: token.id,
      label: token.label,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      revokedAt: token.revokedAt?.toISOString() ?? null,
      viewCount: token.viewCount,
      lastViewedAt: token.lastViewedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      createdByName: token.createdBy.name,
      active:
        !token.revokedAt &&
        (!token.expiresAt || token.expiresAt.getTime() > Date.now()),
    })),
  };
}

export async function listCatalogSelections(user: AuthUser) {
  assertCatalogAccess(user);
  const rows = await prisma.catalogSelection.findMany({
    where: { companyId: user.companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          catalogVehicle: {
            include: { customsEstimate: true },
          },
        },
      },
      shareTokens: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  return rows.map(serializeSelection);
}

export async function getCatalogSelection(user: AuthUser, id: string) {
  assertCatalogAccess(user);
  const record = await prisma.catalogSelection.findFirst({
    where: { id, companyId: user.companyId },
    include: selectionInclude,
  });
  if (!record) throw new Error("NOT_FOUND");
  return serializeSelection(record);
}

export async function createCatalogSelection(user: AuthUser, body: CreateInput) {
  assertCatalogAccess(user);
  const data = createCatalogSelectionSchema.parse(body);

  if (data.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: data.dealId, companyId: user.companyId },
      select: { id: true },
    });
    if (!deal) throw new Error("NOT_FOUND");
  }

  const vehicleIds = data.vehicleIds ?? [];
  if (vehicleIds.length > 0) {
    const count = await prisma.catalogVehicle.count({
      where: { id: { in: vehicleIds }, companyId: user.companyId },
    });
    if (count !== vehicleIds.length) throw new Error("NOT_FOUND");
  }

  const selection = await prisma.catalogSelection.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      title: data.title,
      note: data.note ?? "",
      dealId: data.dealId || null,
      items: {
        create: vehicleIds.map((catalogVehicleId, index) => ({
          catalogVehicleId,
          sortOrder: index,
        })),
      },
    },
    include: selectionInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogSelection",
    entityId: selection.id,
    action: "CREATE",
    newValue: { title: selection.title, itemCount: selection.items.length },
  });

  return serializeSelection(selection);
}

export async function updateCatalogSelection(user: AuthUser, id: string, body: UpdateInput) {
  assertCatalogAccess(user);
  const data = updateCatalogSelectionSchema.parse(body);

  const existing = await prisma.catalogSelection.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (data.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: data.dealId, companyId: user.companyId },
      select: { id: true },
    });
    if (!deal) throw new Error("NOT_FOUND");
  }

  const updated = await prisma.catalogSelection.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.dealId !== undefined ? { dealId: data.dealId } : {}),
    },
    include: selectionInclude,
  });

  return serializeSelection(updated);
}

export async function deleteCatalogSelection(user: AuthUser, id: string) {
  assertCatalogAccess(user);
  const existing = await prisma.catalogSelection.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, title: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  await prisma.catalogSelection.delete({ where: { id } });
  await createAuditLog({
    userId: user.id,
    entity: "CatalogSelection",
    entityId: id,
    action: "DELETE",
    oldValue: { title: existing.title },
  });
}

export async function addCatalogSelectionItem(user: AuthUser, selectionId: string, body: AddItemInput) {
  assertCatalogAccess(user);
  const data = addSelectionItemSchema.parse(body);

  const selection = await prisma.catalogSelection.findFirst({
    where: { id: selectionId, companyId: user.companyId },
    select: { id: true },
  });
  if (!selection) throw new Error("NOT_FOUND");

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: data.catalogVehicleId, companyId: user.companyId },
    select: { id: true },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  const last = await prisma.catalogSelectionItem.findFirst({
    where: { selectionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.catalogSelectionItem.upsert({
    where: {
      selectionId_catalogVehicleId: {
        selectionId,
        catalogVehicleId: data.catalogVehicleId,
      },
    },
    create: {
      selectionId,
      catalogVehicleId: data.catalogVehicleId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      note: data.note ?? "",
    },
    update: {
      note: data.note ?? "",
    },
  });

  return getCatalogSelection(user, selectionId);
}

export async function removeCatalogSelectionItem(
  user: AuthUser,
  selectionId: string,
  itemId: string,
) {
  assertCatalogAccess(user);
  const item = await prisma.catalogSelectionItem.findFirst({
    where: { id: itemId, selection: { id: selectionId, companyId: user.companyId } },
    select: { id: true },
  });
  if (!item) throw new Error("NOT_FOUND");
  await prisma.catalogSelectionItem.delete({ where: { id: itemId } });
  return getCatalogSelection(user, selectionId);
}

export async function createCatalogSelectionShareToken(
  user: AuthUser,
  selectionId: string,
  body: ShareInput,
) {
  assertCatalogAccess(user);
  const data = createShareTokenSchema.parse(body);

  const selection = await prisma.catalogSelection.findFirst({
    where: { id: selectionId, companyId: user.companyId },
    select: { id: true, title: true },
  });
  if (!selection) throw new Error("NOT_FOUND");

  const token = createShareToken();
  const tokenHash = hashShareToken(token);
  const expiresAt =
    data.expiresInDays != null
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const record = await prisma.catalogSelectionShareToken.create({
    data: {
      selectionId,
      tokenHash,
      label: data.label?.trim() || null,
      expiresAt,
      createdById: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "CatalogSelectionShareToken",
    entityId: record.id,
    action: "CREATE",
    newValue: { selectionId, label: record.label },
  });

  return {
    id: record.id,
    token,
    url: buildPublicSelectionUrl(token),
    label: record.label,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function revokeCatalogSelectionShareToken(
  user: AuthUser,
  selectionId: string,
  tokenId: string,
) {
  assertCatalogAccess(user);
  const record = await prisma.catalogSelectionShareToken.findFirst({
    where: {
      id: tokenId,
      selectionId,
      selection: { companyId: user.companyId },
    },
    select: { id: true },
  });
  if (!record) throw new Error("NOT_FOUND");

  await prisma.catalogSelectionShareToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

export async function getPublicCatalogSelection(token: string) {
  const tokenHash = hashShareToken(token);
  const record = await prisma.catalogSelectionShareToken.findUnique({
    where: { tokenHash },
    include: {
      selection: {
        include: {
          company: {
            select: {
              name: true,
              appearanceSettings: { select: { logoUrl: true, presetId: true, customBrandHsl: true } },
            },
          },
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              catalogVehicle: {
                include: { customsEstimate: true },
              },
            },
          },
        },
      },
    },
  });

  if (!record) throw new Error("NOT_FOUND");
  if (record.revokedAt) throw new Error("REVOKED");
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) throw new Error("EXPIRED");

  await prisma.catalogSelectionShareToken.update({
    where: { id: record.id },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });

  const selection = record.selection;
  return {
    title: selection.title,
    note: selection.note,
    companyName: selection.company.name,
    appearance: selection.company.appearanceSettings,
    items: selection.items.map(serializeSelectionItem),
  };
}
