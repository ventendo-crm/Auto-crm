import { CatalogVehicleStatus, MediaType, Prisma } from "@prisma/client";
import {
  buildCatalogVehicleClipboard,
  buildPublicCatalogVehicleUrl,
  createShareToken,
  hashShareToken,
  publicCatalogVehicleMediaPath,
} from "@/lib/catalog/share-token";
import {
  catalogTrimIdsKey,
  minCatalogTrimTotal,
  normalizeCatalogTrimIds,
  parseVisibleTrimIds,
} from "@/lib/catalog/trims";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { serializeGalleryUrls } from "@/lib/services/catalog-serialize";
import type { PublicCatalogTrim, PublicCatalogVehicleData } from "@/lib/types/catalog";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";
import { catalogShareVehicleSchema } from "@/lib/validators/catalog";

function serializePublicTrim(trim: {
  id: string;
  title: string;
  customsEstimate: {
    totalWithCar: Prisma.Decimal;
    input: Prisma.JsonValue;
    result: Prisma.JsonValue;
  } | null;
}): PublicCatalogTrim {
  const estimate = trim.customsEstimate;
  return {
    id: trim.id,
    title: trim.title,
    totalWithCar: estimate ? Number(estimate.totalWithCar) : null,
    estimateInput: estimate ? (estimate.input as unknown as CustomsCalculatorInput) : null,
    estimateResult: estimate ? (estimate.result as unknown as CustomsCalculatorResult) : null,
  };
}

export async function shareCatalogVehicle(
  user: AuthUser,
  vehicleId: string,
  rawBody?: unknown,
) {
  await assertCompanyCatalogAccess(user);
  const body = catalogShareVehicleSchema.parse(rawBody ?? {});

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId, status: CatalogVehicleStatus.ACTIVE },
    include: {
      trims: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { customsEstimate: true },
      },
    },
  });
  if (!vehicle) throw new Error("NOT_FOUND");
  if (vehicle.trims.length === 0) throw new Error("NOT_FOUND");

  const requested = body.trimIds?.length
    ? normalizeCatalogTrimIds(body.trimIds)
    : vehicle.trims.map((trim) => trim.id);
  const allowed = new Set(vehicle.trims.map((trim) => trim.id));
  const visibleTrimIds = requested.filter((id) => allowed.has(id));
  if (visibleTrimIds.length === 0) throw new Error("TRIMS_REQUIRED");

  const visibleKey = catalogTrimIdsKey(visibleTrimIds);
  const tokens = await prisma.catalogVehicleShareToken.findMany({
    where: {
      catalogVehicleId: vehicleId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const matching = tokens.find((item) => {
    const stored = parseVisibleTrimIds(item.visibleTrimIds);
    if (stored.length === 0) {
      return visibleTrimIds.length === vehicle.trims.length;
    }
    return catalogTrimIdsKey(stored) === visibleKey;
  });

  let token = matching?.publicToken?.trim() || "";
  if (!token) {
    token = createShareToken();
    await prisma.catalogVehicleShareToken.create({
      data: {
        catalogVehicleId: vehicleId,
        tokenHash: hashShareToken(token),
        publicToken: token,
        visibleTrimIds,
        createdById: user.id,
      },
    });
  }

  const selected = vehicle.trims.filter((trim) => visibleTrimIds.includes(trim.id));
  const url = buildPublicCatalogVehicleUrl(token);
  const clipboardLines = selected.map((trim) => ({
    title: trim.title,
    totalRub: trim.customsEstimate ? Number(trim.customsEstimate.totalWithCar) : null,
  }));

  return {
    token,
    url,
    clipboard: buildCatalogVehicleClipboard(
      url,
      vehicle.titleRu,
      selected.length === 1
        ? clipboardLines[0]?.totalRub ?? null
        : clipboardLines,
    ),
  };
}

export async function getPublicCatalogVehicle(token: string): Promise<PublicCatalogVehicleData> {
  const tokenHash = hashShareToken(token);
  const record = await prisma.catalogVehicleShareToken.findUnique({
    where: { tokenHash },
    include: {
      catalogVehicle: {
        include: {
          company: { select: { name: true } },
          media: {
            orderBy: { uploadedAt: "asc" },
            select: { id: true, type: true },
          },
          trims: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: { customsEstimate: true },
          },
        },
      },
    },
  });

  if (!record || record.revokedAt) throw new Error("NOT_FOUND");
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) throw new Error("EXPIRED");

  const vehicle = record.catalogVehicle;
  if (vehicle.status !== CatalogVehicleStatus.ACTIVE) throw new Error("NOT_FOUND");

  await prisma.catalogVehicleShareToken.update({
    where: { id: record.id },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });

  const mediaItems = vehicle.media.map((item) => ({
    url: publicCatalogVehicleMediaPath(token, item.id),
    type: item.type === MediaType.VIDEO ? ("video" as const) : ("photo" as const),
  }));
  const gallery = serializeGalleryUrls(vehicle.galleryUrls);
  const fallbackPhotos = [vehicle.coverImageUrl, ...gallery].filter((url): url is string => Boolean(url));
  const media =
    mediaItems.length > 0
      ? mediaItems
      : fallbackPhotos.map((url) => ({ url, type: "photo" as const }));
  const photos = media.filter((item) => item.type === "photo").map((item) => item.url);

  const storedIds = parseVisibleTrimIds(record.visibleTrimIds);
  const visible =
    storedIds.length === 0
      ? vehicle.trims
      : vehicle.trims.filter((trim) => storedIds.includes(trim.id));
  const trims = (visible.length > 0 ? visible : vehicle.trims).map(serializePublicTrim);
  const cheapest = minCatalogTrimTotal(
    trims.map((trim) => ({ estimate: trim.totalWithCar != null ? { totalWithCar: trim.totalWithCar } : null })),
  );
  const firstWithCalc = trims.find((trim) => trim.estimateInput && trim.estimateResult) ?? trims[0];

  return {
    companyName: vehicle.company.name,
    title: vehicle.titleRu || vehicle.titleZh || "Авто из каталога",
    description: vehicle.descriptionRu || vehicle.descriptionZh || "",
    photos,
    media,
    trims,
    totalWithCar: cheapest?.min ?? firstWithCalc?.totalWithCar ?? null,
    estimateInput: firstWithCalc?.estimateInput ?? null,
    estimateResult: firstWithCalc?.estimateResult ?? null,
  };
}

export async function getPublicCatalogVehicleMedia(
  token: string,
  mediaId: string,
): Promise<{ fileUrl: string; fileName: string }> {
  const tokenHash = hashShareToken(token);
  const record = await prisma.catalogVehicleShareToken.findUnique({
    where: { tokenHash },
    include: {
      catalogVehicle: {
        select: {
          status: true,
          media: {
            where: { id: mediaId },
            select: { id: true, fileUrl: true, fileName: true },
          },
        },
      },
    },
  });

  if (!record || record.revokedAt) throw new Error("NOT_FOUND");
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) throw new Error("EXPIRED");
  if (record.catalogVehicle.status !== CatalogVehicleStatus.ACTIVE) throw new Error("NOT_FOUND");

  const media = record.catalogVehicle.media[0];
  if (!media) throw new Error("NOT_FOUND");
  return { fileUrl: media.fileUrl, fileName: media.fileName };
}
