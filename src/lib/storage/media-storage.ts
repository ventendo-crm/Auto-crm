import { MediaType } from "@prisma/client";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  buildObjectKey,
  buildThumbnailKey,
  deleteObject,
  getObjectBuffer,
  getObjectStream,
  headObject,
  uploadObject,
} from "@/lib/storage/minio";
import { ByteRange, parseByteRange } from "@/lib/storage/http-range";
import { createJpegThumbnail } from "@/lib/storage/media-thumbnail";
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
  rangeHeader?: string | null,
): Promise<{
  stream: ReadableStream | null;
  contentType: string;
  fileName: string;
  size: number;
  range: ByteRange | null;
  status: 200 | 206 | 416;
}> {
  const contentType = guessMediaContentType(fileName);

  if (isLocalMediaUrl(storedKey)) {
    const filePath = path.join(localUploadsDir(), path.basename(storedKey));
    const fileStat = await stat(filePath);
    const size = fileStat.size;
    const parsed = parseByteRange(rangeHeader, size);

    if (parsed === "unsatisfiable") {
      return { stream: null, contentType, fileName, size, range: null, status: 416 };
    }

    const range = parsed;
    const start = range?.start ?? 0;
    const end = range?.end ?? size - 1;
    const nodeStream = createReadStream(filePath, { start, end });

    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream,
      contentType,
      fileName,
      size,
      range,
      status: range ? 206 : 200,
    };
  }

  const objectHead = await headObject(storedKey);
  const size = objectHead.contentLength;
  const parsed = parseByteRange(rangeHeader, size);

  if (parsed === "unsatisfiable") {
    return {
      stream: null,
      contentType: objectHead.contentType ?? contentType,
      fileName,
      size,
      range: null,
      status: 416,
    };
  }

  const object = await getObjectStream(storedKey, parsed ?? undefined);

  return {
    stream: object.body,
    contentType: object.contentType ?? objectHead.contentType ?? contentType,
    fileName,
    size,
    range: parsed,
    status: parsed ? 206 : 200,
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
    const thumbBody = await createJpegThumbnail(params.buffer).catch(() => params.buffer);
    await uploadObject({
      key: thumbnailKey,
      body: thumbBody,
      contentType: "image/jpeg",
    });
  }

  return { fileKey: objectKey, thumbnailKey };
}

async function storeToLocal(params: {
  dealId: string;
  mediaId: string;
  fileName: string;
  buffer: Buffer;
  mediaType: MediaType;
}): Promise<{ fileKey: string; thumbnailKey: string | null }> {
  const uploadsDir = localUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const storedName = toLocalFileName(params.dealId, params.mediaId, params.fileName);
  await writeFile(path.join(uploadsDir, storedName), params.buffer);

  const fileUrl = `/api/uploads/${storedName}`;
  if (params.mediaType !== MediaType.PHOTO) {
    return { fileKey: fileUrl, thumbnailKey: null };
  }

  const thumbName = `thumb-${params.mediaId}.jpg`;
  const thumbBody = await createJpegThumbnail(params.buffer).catch(() => null);
  if (!thumbBody) {
    return { fileKey: fileUrl, thumbnailKey: fileUrl };
  }
  await writeFile(path.join(uploadsDir, thumbName), thumbBody);
  return { fileKey: fileUrl, thumbnailKey: `/api/uploads/${thumbName}` };
}

export async function readStoredMediaBuffer(storedKey: string): Promise<Buffer> {
  if (isLocalMediaUrl(storedKey)) {
    return readFile(path.join(localUploadsDir(), path.basename(storedKey)));
  }
  return getObjectBuffer(storedKey);
}

export async function writeStoredMediaFile(params: {
  storedKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  if (isLocalMediaUrl(params.storedKey)) {
    const uploadsDir = localUploadsDir();
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, path.basename(params.storedKey)), params.body);
    return;
  }
  await uploadObject({
    key: params.storedKey,
    body: params.body,
    contentType: params.contentType,
  });
}

export async function headStoredMediaSize(storedKey: string): Promise<number | null> {
  try {
    if (isLocalMediaUrl(storedKey)) {
      const fileStat = await stat(path.join(localUploadsDir(), path.basename(storedKey)));
      return fileStat.size;
    }
    const objectHead = await headObject(storedKey);
    return objectHead.contentLength;
  } catch {
    return null;
  }
}

export function thumbnailStorageKey(fileUrl: string, mediaId: string): string {
  if (isLocalMediaUrl(fileUrl)) {
    return `/api/uploads/thumb-${mediaId}.jpg`;
  }
  const parts = fileUrl.split("/");
  if (parts[0] === "deals" && parts.length >= 3) {
    return buildThumbnailKey(parts[1], parts[2]);
  }
  return `thumbs/${mediaId}.jpg`;
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
