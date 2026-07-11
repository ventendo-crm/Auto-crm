import { MediaType, Prisma } from "@prisma/client";
import { MAX_PROCESS_ENTRY_MEDIA, MAX_TRACKING_POINT_MEDIA } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { AuthUser, canUpdateDeal, canViewDeal } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { getManagerPeerIdsForUser } from "@/lib/services/deal-access";
import {
  openStoredMediaFile,
  removeMediaFile,
  storeMediaFile,
} from "@/lib/storage/media-storage";
import {
  detectMediaTypeFromFile,
  getMaxSizeForType,
} from "@/lib/validators/media";

const mediaInclude = {
  uploadedBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

type MediaRecord = Prisma.MediaFileGetPayload<{ include: typeof mediaInclude }>;

export interface MediaWithUrls {
  id: string;
  type: MediaType;
  fileName: string;
  fileKey: string;
  thumbnailKey: string | null;
  fileUrl: string;
  thumbnailUrl: string | null;
  size: number;
  dealId: string | null;
  taskId: string | null;
  uploadedById: string;
  uploadedAt: string;
  uploadedBy: { id: string; name: string; email: string };
}

export const SEARCH_PROCESS_MEDIA_INCLUDE = mediaInclude;

function buildMediaFileUrl(mediaId: string, variant: "full" | "thumb" = "full"): string {
  if (variant === "thumb") {
    return `/api/media/${mediaId}/file?variant=thumb`;
  }
  return `/api/media/${mediaId}/file`;
}

async function enrichMedia(media: MediaRecord): Promise<MediaWithUrls> {
  const fileUrl = buildMediaFileUrl(media.id);
  const thumbnailUrl = media.thumbnailUrl ? buildMediaFileUrl(media.id, "thumb") : null;

  return {
    id: media.id,
    type: media.type,
    fileName: media.fileName,
    fileKey: media.fileUrl,
    thumbnailKey: media.thumbnailUrl,
    fileUrl,
    thumbnailUrl,
    size: media.size,
    dealId: media.dealId,
    taskId: media.taskId,
    uploadedById: media.uploadedById,
    uploadedAt: media.uploadedAt.toISOString(),
    uploadedBy: media.uploadedBy,
  };
}

export async function enrichMediaRecord(media: MediaRecord): Promise<MediaWithUrls> {
  return enrichMedia(media);
}

async function assertDealAccess(user: AuthUser, dealId: string, write = false) {
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

export async function assertDealMediaAccess(user: AuthUser, dealId: string, write = false) {
  return assertDealAccess(user, dealId, write);
}

export async function listDealMedia(user: AuthUser, dealId: string) {
  await assertDealAccess(user, dealId);

  const items = await prisma.mediaFile.findMany({
    where: { dealId, searchProcessEntryId: null, importProcessEntryId: null, carCarrierTrackingPointId: null },
    orderBy: { uploadedAt: "desc" },
    include: mediaInclude,
  });

  return Promise.all(items.map(enrichMedia));
}

export async function uploadDealMedia(
  user: AuthUser,
  dealId: string,
  file: File,
  options?: {
    searchProcessEntryId?: string;
    importProcessEntryId?: string;
    carCarrierTrackingPointId?: string;
  },
) {
  await assertDealAccess(user, dealId, true);

  let searchEntry: { sortOrder: number } | null = null;
  let importEntry: { sortOrder: number } | null = null;
  let trackingPoint: { sortOrder: number } | null = null;

  if (options?.searchProcessEntryId) {
    const entry = await prisma.searchProcessEntry.findFirst({
      where: { id: options.searchProcessEntryId, dealId },
      include: { _count: { select: { media: true } } },
    });

    if (!entry) {
      throw new Error("Not found");
    }

    searchEntry = entry;

    if (entry._count.media >= MAX_PROCESS_ENTRY_MEDIA) {
      throw new Error(`Максимум ${MAX_PROCESS_ENTRY_MEDIA} файлов на вариант`);
    }
  }

  if (options?.importProcessEntryId) {
    const entry = await prisma.importProcessEntry.findFirst({
      where: { id: options.importProcessEntryId, dealId },
      include: { _count: { select: { media: true } } },
    });

    if (!entry) {
      throw new Error("Not found");
    }

    importEntry = entry;

    if (entry._count.media >= MAX_PROCESS_ENTRY_MEDIA) {
      throw new Error(`Максимум ${MAX_PROCESS_ENTRY_MEDIA} файлов на этап`);
    }
  }

  if (options?.carCarrierTrackingPointId) {
    const point = await prisma.carCarrierTrackingPoint.findFirst({
      where: { id: options.carCarrierTrackingPointId, dealId },
      include: { _count: { select: { media: true } } },
    });

    if (!point) {
      throw new Error("Not found");
    }

    trackingPoint = point;

    if (point._count.media >= MAX_TRACKING_POINT_MEDIA) {
      throw new Error(`Максимум ${MAX_TRACKING_POINT_MEDIA} фото на точку`);
    }
  }

  const mediaType = detectMediaTypeFromFile(file);
  if (!mediaType) {
    throw new Error("Неподдерживаемый формат. Разрешены: JPEG, PNG, WebP, GIF, MP4, WebM, MOV");
  }

  if (file.size > getMaxSizeForType(mediaType)) {
    const maxMb = Math.round(getMaxSizeForType(mediaType) / 1024 / 1024);
    throw new Error(
      `Файл слишком большой. Максимум ${maxMb} МБ для ${mediaType === MediaType.PHOTO ? "фото" : "видео"}`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaId = crypto.randomUUID();

  const { fileKey, thumbnailKey } = await storeMediaFile({
    dealId,
    mediaId,
    fileName: file.name,
    buffer,
    contentType: file.type || "application/octet-stream",
    mediaType,
  });

  const record = await prisma.mediaFile.create({
    data: {
      type: mediaType,
      fileName: file.name,
      fileUrl: fileKey,
      thumbnailUrl: thumbnailKey,
      size: file.size,
      dealId,
      searchProcessEntryId: options?.searchProcessEntryId ?? null,
      importProcessEntryId: options?.importProcessEntryId ?? null,
      carCarrierTrackingPointId: options?.carCarrierTrackingPointId ?? null,
      uploadedById: user.id,
    },
    include: mediaInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "MediaFile",
    entityId: record.id,
    action: "CREATE",
    newValue: {
      dealId,
      fileName: file.name,
      type: mediaType,
      ...(options?.searchProcessEntryId
        ? {
            searchProcessEntryId: options.searchProcessEntryId,
            sortOrder: searchEntry?.sortOrder,
            variantNumber: (searchEntry?.sortOrder ?? 0) + 1,
          }
        : {}),
      ...(options?.importProcessEntryId
        ? {
            importProcessEntryId: options.importProcessEntryId,
            sortOrder: importEntry?.sortOrder,
            stageNumber: (importEntry?.sortOrder ?? 0) + 1,
          }
        : {}),
      ...(options?.carCarrierTrackingPointId
        ? {
            carCarrierTrackingPointId: options.carCarrierTrackingPointId,
            sortOrder: trackingPoint?.sortOrder,
          }
        : {}),
    },
  });

  return enrichMedia(record);
}

export async function deleteMedia(user: AuthUser, mediaId: string) {
  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaId },
    include: {
      deal: { select: { managerId: true } },
      searchProcessEntry: { select: { sortOrder: true } },
      importProcessEntry: { select: { sortOrder: true } },
    },
  });

  if (!media) {
    throw new Error("Not found");
  }

  if (media.dealId) {
    await assertDealAccess(user, media.dealId, true);
  } else if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  await removeMediaFile(media.fileUrl, media.thumbnailUrl);

  await prisma.mediaFile.delete({ where: { id: mediaId } });

  await createAuditLog({
    userId: user.id,
    entity: "MediaFile",
    entityId: mediaId,
    action: "DELETE",
    oldValue: {
      fileName: media.fileName,
      dealId: media.dealId,
      ...(media.searchProcessEntryId
        ? {
            searchProcessEntryId: media.searchProcessEntryId,
            sortOrder: media.searchProcessEntry?.sortOrder,
            variantNumber: (media.searchProcessEntry?.sortOrder ?? 0) + 1,
          }
        : {}),
      ...(media.importProcessEntryId
        ? {
            importProcessEntryId: media.importProcessEntryId,
            sortOrder: media.importProcessEntry?.sortOrder,
            stageNumber: (media.importProcessEntry?.sortOrder ?? 0) + 1,
          }
        : {}),
    },
  });
}

export async function getMediaById(user: AuthUser, mediaId: string) {
  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaId },
    include: mediaInclude,
  });

  if (!media) {
    throw new Error("Not found");
  }

  if (media.dealId) {
    await assertDealAccess(user, media.dealId);
  } else if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return enrichMedia(media);
}

export async function streamMediaFile(
  user: AuthUser,
  mediaId: string,
  variant: "full" | "thumb" = "full",
) {
  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      thumbnailUrl: true,
      dealId: true,
    },
  });

  if (!media) {
    throw new Error("Not found");
  }

  if (media.dealId) {
    await assertDealAccess(user, media.dealId);
  } else if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  const storedKey =
    variant === "thumb" && media.thumbnailUrl ? media.thumbnailUrl : media.fileUrl;

  return openStoredMediaFile(storedKey, media.fileName);
}
