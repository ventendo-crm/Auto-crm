import { MediaType } from "@prisma/client";
import { MAX_CATALOG_VEHICLE_PHOTOS } from "@/lib/constants";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { getCatalogVehicle } from "@/lib/services/catalog-vehicles";
import { createAuditLog } from "@/lib/services/audit";
import {
  detectMediaTypeFromBuffer,
  detectMediaTypeFromFile,
  getMaxSizeForType,
  UNSUPPORTED_MEDIA_FORMAT_MESSAGE,
} from "@/lib/validators/media";
import { removeMediaFile, storeMediaFile } from "@/lib/storage/media-storage";

export async function uploadCatalogVehiclePhoto(user: AuthUser, vehicleId: string, file: File) {
  await assertCompanyCatalogAccess(user);

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    include: { _count: { select: { media: true } } },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  if (vehicle._count.media >= MAX_CATALOG_VEHICLE_PHOTOS) {
    throw new Error(`Максимум ${MAX_CATALOG_VEHICLE_PHOTOS} фото`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = detectMediaTypeFromFile(file) ?? detectMediaTypeFromBuffer(buffer);
  if (mediaType !== MediaType.PHOTO) {
    throw new Error(UNSUPPORTED_MEDIA_FORMAT_MESSAGE);
  }
  if (file.size > getMaxSizeForType(mediaType)) {
    throw new Error("Файл слишком большой. Максимум 10 МБ для фото");
  }

  const mediaId = crypto.randomUUID();
  const { fileKey, thumbnailKey } = await storeMediaFile({
    dealId: vehicleId,
    mediaId,
    fileName: file.name,
    buffer,
    contentType: file.type || "image/jpeg",
    mediaType,
  });

  const record = await prisma.mediaFile.create({
    data: {
      type: MediaType.PHOTO,
      fileName: file.name,
      fileUrl: fileKey,
      thumbnailUrl: thumbnailKey,
      size: file.size,
      catalogVehicleId: vehicleId,
      uploadedById: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "MediaFile",
    entityId: record.id,
    action: "CREATE",
    newValue: { catalogVehicleId: vehicleId, fileName: file.name },
  });

  return getCatalogVehicle(user, vehicleId);
}

export async function deleteCatalogVehiclePhoto(user: AuthUser, vehicleId: string, mediaId: string) {
  await assertCompanyCatalogAccess(user);

  const media = await prisma.mediaFile.findFirst({
    where: {
      id: mediaId,
      catalogVehicleId: vehicleId,
      catalogVehicle: { companyId: user.companyId },
    },
  });
  if (!media) throw new Error("NOT_FOUND");

  await removeMediaFile(media.fileUrl, media.thumbnailUrl);
  await prisma.mediaFile.delete({ where: { id: mediaId } });

  return getCatalogVehicle(user, vehicleId);
}
