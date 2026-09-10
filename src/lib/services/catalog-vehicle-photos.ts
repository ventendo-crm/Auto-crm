import { MediaType } from "@prisma/client";
import { MAX_CATALOG_VEHICLE_MEDIA } from "@/lib/constants";
import { AuthUser } from "@/lib/permissions";
import { assertCompanyCatalogAccess } from "@/lib/services/company-workspace";
import { prisma } from "@/lib/prisma";
import { getCatalogVehicle } from "@/lib/services/catalog-vehicles";
import { assertVehicleTrimAccess } from "@/lib/services/catalog-trims";
import { createAuditLog } from "@/lib/services/audit";
import {
  detectMediaTypeFromBuffer,
  detectMediaTypeFromFile,
  getMaxSizeForType,
  guessMediaContentType,
  UNSUPPORTED_MEDIA_FORMAT_MESSAGE,
} from "@/lib/validators/media";
import { removeMediaFile, storeMediaFile } from "@/lib/storage/media-storage";

export async function uploadCatalogVehiclePhoto(
  user: AuthUser,
  vehicleId: string,
  file: File,
  trimId?: string | null,
) {
  const { trim } = await assertVehicleTrimAccess(user, vehicleId, trimId);

  const mediaCount = await prisma.mediaFile.count({
    where: { catalogVehicleTrimId: trim.id },
  });
  if (mediaCount >= MAX_CATALOG_VEHICLE_MEDIA) {
    throw new Error(`Максимум ${MAX_CATALOG_VEHICLE_MEDIA} файлов (фото и видео)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = detectMediaTypeFromFile(file) ?? detectMediaTypeFromBuffer(buffer);
  if (mediaType !== MediaType.PHOTO && mediaType !== MediaType.VIDEO) {
    throw new Error(UNSUPPORTED_MEDIA_FORMAT_MESSAGE);
  }
  if (file.size > getMaxSizeForType(mediaType)) {
    throw new Error(
      mediaType === MediaType.PHOTO
        ? "Файл слишком большой. Максимум 10 МБ для фото"
        : "Файл слишком большой. Максимум 100 МБ для видео",
    );
  }

  const mediaId = crypto.randomUUID();
  const { fileKey, thumbnailKey } = await storeMediaFile({
    dealId: vehicleId,
    mediaId,
    fileName: file.name,
    buffer,
    contentType: file.type || guessMediaContentType(file.name),
    mediaType,
  });

  const record = await prisma.mediaFile.create({
    data: {
      type: mediaType,
      fileName: file.name,
      fileUrl: fileKey,
      thumbnailUrl: thumbnailKey,
      size: file.size,
      catalogVehicleId: vehicleId,
      catalogVehicleTrimId: trim.id,
      uploadedById: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "MediaFile",
    entityId: record.id,
    action: "CREATE",
    newValue: {
      catalogVehicleId: vehicleId,
      catalogVehicleTrimId: trim.id,
      fileName: file.name,
      type: mediaType,
    },
  });

  return getCatalogVehicle(user, vehicleId);
}

export async function deleteCatalogVehiclePhoto(user: AuthUser, vehicleId: string, mediaId: string) {
  await assertCompanyCatalogAccess(user);

  const media = await prisma.mediaFile.findFirst({
    where: {
      id: mediaId,
      OR: [
        { catalogVehicleId: vehicleId, catalogVehicle: { companyId: user.companyId } },
        {
          catalogVehicleTrim: {
            catalogVehicleId: vehicleId,
            catalogVehicle: { companyId: user.companyId },
          },
        },
      ],
    },
  });
  if (!media) throw new Error("NOT_FOUND");

  await removeMediaFile(media.fileUrl, media.thumbnailUrl);
  await prisma.mediaFile.delete({ where: { id: mediaId } });

  return getCatalogVehicle(user, vehicleId);
}
