import { MediaType } from "@prisma/client";
import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  buildObjectKey,
  buildThumbnailKey,
  deleteObject,
  getObjectStream,
  uploadObject,
} from "@/lib/storage/minio";
import { guessMediaContentType } from "@/lib/validators/media";

function storageMode(): "local" | "minio" | "auto" {
  const mode = process.env.MEDIA_STORAGE?.trim().toLowerCase();
  if (mode === "local") return "local";
  if (mode === "minio") return "minio";
  return "auto";
}

export async function storeMediaFile(params: {
  dealId: string;
  mediaId: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  mediaType: MediaType;
}): Promise<{ fileKey: string; thumbnailKey: string | null }> {
  const mode = storageMode();

  if (mode === "local") {
    return storeToLocal(params);
  }

  if (mode === "minio") {
    return storeToMinio(params);
  }

  try {
    return await storeToMinio(params);
  } catch (error) {
    console.warn("[media-storage] MinIO unavailable, falling back to local storage:", error);
    return storeToLocal(params);
  }
}

function localUploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

function toLocalFileName(dealId: string, mediaId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-()а-яА-ЯёЁ ]+/g, "_");
  return `media-${dealId.slice(0, 8)}-${mediaId.slice(0, 8)}-${Date.now()}-${safeName}`;
}

export function isLocalMediaUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("/api/uploads/");
}

export async function openStoredMediaFile(
  storedKey: string,
  fileName: string,
): Promise<{
  stream: ReadableStream;
  contentType: string;
  fileName: string;
  size?: number;
}> {
  const contentType = guessMediaContentType(fileName);

  if (isLocalMediaUrl(storedKey)) {
    const filePath = path.join(localUploadsDir(), path.basename(storedKey));
    const fileStat = await stat(filePath);
    const nodeStream = createReadStream(filePath);

    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream,
      contentType,
      fileName,
      size: fileStat.size,
    };
  }

  const object = await getObjectStream(storedKey);

  return {
    stream: object.body,
    contentType: object.contentType ?? contentType,
    fileName,
    size: object.contentLength,
  };
}

async function storeToMinio(params: {
  dealId: string;
  mediaId: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  mediaType: MediaType;
}): Promise<{ fileKey: string; thumbnailKey: string | null }> {
  const objectKey = buildObjectKey(params.dealId, params.mediaId, params.fileName);

  await uploadObject({
    key: objectKey,
    body: params.buffer,
    contentType: params.contentType,
  });

  let thumbnailKey: string | null = null;
  if (params.mediaType === MediaType.PHOTO) {
    thumbnailKey = buildThumbnailKey(params.dealId, params.mediaId);
    await uploadObject({
      key: thumbnailKey,
      body: params.buffer,
      contentType: params.contentType,
    });
  }

  return { fileKey: objectKey, thumbnailKey };
}

async function storeToLocal(params: {
  dealId: string;
  mediaId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ fileKey: string; thumbnailKey: string | null }> {
  const uploadsDir = localUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const storedName = toLocalFileName(params.dealId, params.mediaId, params.fileName);
  await writeFile(path.join(uploadsDir, storedName), params.buffer);

  const fileUrl = `/api/uploads/${storedName}`;
  return { fileKey: fileUrl, thumbnailKey: fileUrl };
}

export async function removeMediaFile(fileUrl: string, thumbnailUrl?: string | null): Promise<void> {
  if (isLocalMediaUrl(fileUrl)) {
    const fileName = path.basename(fileUrl);
    await unlink(path.join(localUploadsDir(), fileName)).catch(() => undefined);
    if (thumbnailUrl && thumbnailUrl !== fileUrl && isLocalMediaUrl(thumbnailUrl)) {
      const thumbName = path.basename(thumbnailUrl);
      await unlink(path.join(localUploadsDir(), thumbName)).catch(() => undefined);
    }
    return;
  }

  await deleteObject(fileUrl);
  if (thumbnailUrl && thumbnailUrl !== fileUrl) {
    await deleteObject(thumbnailUrl).catch(() => undefined);
  }
}
