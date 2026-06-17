import { MediaType } from "@prisma/client";

export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export function detectMediaType(mimeType: string): MediaType | null {
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) return MediaType.PHOTO;
  if (ALLOWED_VIDEO_TYPES.has(mimeType)) return MediaType.VIDEO;
  return null;
}

const EXTENSION_MEDIA_TYPE: Record<string, MediaType> = {
  jpg: MediaType.PHOTO,
  jpeg: MediaType.PHOTO,
  png: MediaType.PHOTO,
  webp: MediaType.PHOTO,
  gif: MediaType.PHOTO,
  mp4: MediaType.VIDEO,
  webm: MediaType.VIDEO,
  mov: MediaType.VIDEO,
};

export function detectMediaTypeFromFile(file: File): MediaType | null {
  const fromMime = detectMediaType(file.type);
  if (fromMime) return fromMime;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;

  return EXTENSION_MEDIA_TYPE[extension] ?? null;
}

export function getMaxSizeForType(type: MediaType): number {
  return type === MediaType.PHOTO ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
}
