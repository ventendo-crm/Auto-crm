import { MediaType } from "@prisma/client";
import { fetchChinaBinary } from "@/lib/http/china-fetch";
import { AuthUser, canAccessCatalog } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { assertDealMediaAccess } from "@/lib/services/media";
import { serializeGalleryUrls } from "@/lib/services/catalog-serialize";
import { upsertSearchProcessEntryEstimate } from "@/lib/services/search-process-entry-estimates";
import { storeMediaFile } from "@/lib/storage/media-storage";
import { guessMediaContentType } from "@/lib/validators/media";
import { addCatalogVehicleToDealSchema } from "@/lib/validators/catalog";
import { z } from "zod";

type AddToDealInput = z.infer<typeof addCatalogVehicleToDealSchema>;

const MAX_IMAGES_TO_IMPORT = 8;

function buildDescription(titleRu: string, descriptionRu: string, sourceUrl: string | null): string {
  const parts = [titleRu.trim(), descriptionRu.trim()].filter(Boolean);
  if (sourceUrl) parts.push(`Источник: ${sourceUrl}`);
  return parts.join("\n\n");
}

async function importGalleryImages(params: {
  user: AuthUser;
  dealId: string;
  entryId: string;
  galleryUrls: string[];
}) {
  const urls = params.galleryUrls.slice(0, MAX_IMAGES_TO_IMPORT);
  let imported = 0;

  for (const [index, url] of urls.entries()) {
    try {
      const buffer = Buffer.from(await fetchChinaBinary(url));
      if (buffer.length < 1024) continue;

      const fileName = `catalog-${index + 1}.jpg`;
      const mediaId = crypto.randomUUID();
      const { fileKey, thumbnailKey } = await storeMediaFile({
        dealId: params.dealId,
        mediaId,
        fileName,
        buffer,
        contentType: guessMediaContentType(fileName),
        mediaType: MediaType.PHOTO,
      });

      await prisma.mediaFile.create({
        data: {
          type: MediaType.PHOTO,
          fileName,
          fileUrl: fileKey,
          thumbnailUrl: thumbnailKey,
          size: buffer.length,
          dealId: params.dealId,
          searchProcessEntryId: params.entryId,
          uploadedById: params.user.id,
        },
      });
      imported += 1;
    } catch (error) {
      console.warn("[catalog-to-deal] failed to import image:", url, error);
    }
  }

  return imported;
}

export async function addCatalogVehicleToDeal(
  user: AuthUser,
  vehicleId: string,
  body: AddToDealInput,
) {
  if (!canAccessCatalog(user.role)) throw new Error("Forbidden");
  const data = addCatalogVehicleToDealSchema.parse(body);

  await assertDealMediaAccess(user, data.dealId, true);

  const vehicle = await prisma.catalogVehicle.findFirst({
    where: { id: vehicleId, companyId: user.companyId },
    include: { customsEstimate: true },
  });
  if (!vehicle) throw new Error("NOT_FOUND");

  const last = await prisma.searchProcessEntry.findFirst({
    where: { dealId: data.dealId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const entry = await prisma.searchProcessEntry.create({
    data: {
      dealId: data.dealId,
      catalogVehicleId: vehicle.id,
      description: buildDescription(vehicle.titleRu, vehicle.descriptionRu, vehicle.sourceUrl),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      publishedAt: data.publish ? new Date() : null,
    },
  });

  const galleryUrls = serializeGalleryUrls(vehicle.galleryUrls);
  const imagesImported = await importGalleryImages({
    user,
    dealId: data.dealId,
    entryId: entry.id,
    galleryUrls: vehicle.coverImageUrl
      ? [vehicle.coverImageUrl, ...galleryUrls.filter((url) => url !== vehicle.coverImageUrl)]
      : galleryUrls,
  });

  if (vehicle.customsEstimate) {
    const estimate = vehicle.customsEstimate;
    await upsertSearchProcessEntryEstimate(user, data.dealId, entry.id, {
      price: Number(estimate.price),
      currency: estimate.currency as "CNY" | "USD" | "KRW" | "RUB",
      powerHp: estimate.powerHp,
      volumeCc: estimate.volumeCc,
      carYear: estimate.carYear,
      note: estimate.note,
    });
  }

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entry.id,
    action: "CREATE_FROM_CATALOG",
    newValue: {
      dealId: data.dealId,
      catalogVehicleId: vehicle.id,
      imagesImported,
    },
  });

  return {
    entryId: entry.id,
    dealId: data.dealId,
    imagesImported,
  };
}
