import { MediaType } from "@prisma/client";

export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

/** Широкий accept для мобильных галерей (WeChat, Telegram и т.п.). */
export const MEDIA_FILE_ACCEPT = "image/*,video/*";

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
  "video/3gpp",
  "video/3gpp2",
  "video/x-m4v",
  "video/m4v",
  "video/x-msvideo",
  "video/hevc",
  "video/x-matroska",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "3gp", "3gpp", "avi", "mkv"]);

export function detectMediaType(mimeType: string): MediaType | null {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return null;

  if (ALLOWED_IMAGE_TYPES.has(normalized)) return MediaType.PHOTO;
  if (ALLOWED_VIDEO_TYPES.has(normalized)) return MediaType.VIDEO;
  if (normalized.startsWith("image/")) return MediaType.PHOTO;
  if (normalized.startsWith("video/")) return MediaType.VIDEO;

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
  m4v: MediaType.VIDEO,
  "3gp": MediaType.VIDEO,
  "3gpp": MediaType.VIDEO,
  avi: MediaType.VIDEO,
  mkv: MediaType.VIDEO,
};

function detectMediaTypeFromExtension(fileName: string): MediaType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return null;

  if (EXTENSION_MEDIA_TYPE[extension]) {
    return EXTENSION_MEDIA_TYPE[extension];
  }
  if (IMAGE_EXTENSIONS.has(extension)) return MediaType.PHOTO;
  if (VIDEO_EXTENSIONS.has(extension)) return MediaType.VIDEO;

  return null;
}

export function detectMediaTypeFromFile(file: File): MediaType | null {
  const fromMime = detectMediaType(file.type);
  if (fromMime) return fromMime;

  const fromExtension = detectMediaTypeFromExtension(file.name);
  if (fromExtension) return fromExtension;

  // WeChat/Telegram на телефоне часто отдают пустой type или application/octet-stream.
  if (
    !file.type ||
    file.type === "application/octet-stream" ||
    file.type === "binary/octet-stream"
  ) {
    return null;
  }

  return null;
}

export function detectMediaTypeFromBuffer(buffer: Buffer | Uint8Array): MediaType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return MediaType.PHOTO;
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return MediaType.PHOTO;
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return MediaType.PHOTO;
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return MediaType.PHOTO;
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return MediaType.VIDEO;
  }
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return MediaType.VIDEO;
  }

  return null;
}

export function getMaxSizeForType(type: MediaType): number {
  return type === MediaType.PHOTO ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
}

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
};

export function guessMediaContentType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return "application/octet-stream";
  return EXTENSION_CONTENT_TYPE[extension] ?? "application/octet-stream";
}

export const UNSUPPORTED_MEDIA_FORMAT_MESSAGE =
  "Неподдерживаемый формат. Разрешены фото (JPEG, PNG, WebP, GIF) и видео (MP4, MOV, WebM, 3GP и др.)";
