import { CatalogVehicleStatus, MediaType } from "@prisma/client";
import {
  buildCatalogVehicleClipboard,
  buildPublicCatalogVehicleUrl,
  createShareToken,
  hashShareToken,
  publicCatalogVehicleMediaPath,
} from "@/lib/catalog/share-token";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { serializeGalleryUrls } from "@/lib/services/catalog-serialize";
import type { PublicCatalogVehicleData } from "@/lib/types/catalog";
import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

export async function shareCatalogVehicle(user: AuthUser, vehicleId: string) {
  await assertCompanyCatalogAccess(user);

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId, status: CatalogVehicleStatus.ACTIVE },
    include: { customsEstimate: true },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  const active = await prisma.catalogVehicleShareToken.findFirst({
    where: {
      catalogVehicleId: vehicleId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  let token = active?.publicToken?.trim() || "";
  if (!token) {
    if (active) {
      await prisma.catalogVehicleShareToken.update({
        where: { id: active.id },
        data: { revokedAt: new Date() },
      });
    }
    token = createShareToken();
    await prisma.catalogVehicleShareToken.create({
      data: {
        catalogVehicleId: vehicleId,
        tokenHash: hashShareToken(token),
        publicToken: token,
        createdById: user.id,
      },
    });
  }

  const url = buildPublicCatalogVehicleUrl(token);
  return {
    token,
    url,
    clipboard: buildCatalogVehicleClipboard(
      url,
      vehicle.titleRu,
      vehicle.customsEstimate ? Number(vehicle.customsEstimate.totalWithCar) : null,
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
            where: { type: MediaType.PHOTO },
            orderBy: { uploadedAt: "asc" },
            select: { id: true },
          },
          customsEstimate: true,
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

  const mediaPhotos = vehicle.media.map((item) => publicCatalogVehicleMediaPath(token, item.id));
  const gallery = serializeGalleryUrls(vehicle.galleryUrls);
  const photos =
    mediaPhotos.length > 0
      ? mediaPhotos
      : [vehicle.coverImageUrl, ...gallery].filter((url): url is string => Boolean(url));

  const estimate = vehicle.customsEstimate;

  return {
    companyName: vehicle.company.name,
    title: vehicle.titleRu || vehicle.titleZh || "Авто из каталога",
    description: vehicle.descriptionRu || vehicle.descriptionZh || "",
    photos,
    totalWithCar: estimate ? Number(estimate.totalWithCar) : null,
    estimateInput: estimate ? (estimate.input as unknown as CustomsCalculatorInput) : null,
    estimateResult: estimate ? (estimate.result as unknown as CustomsCalculatorResult) : null,
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
