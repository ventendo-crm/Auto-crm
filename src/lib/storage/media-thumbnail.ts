import { MediaType } from "@prisma/client";
import sharp from "sharp";

/** Длинная сторона превью в каталоге и сетках. */
export const MEDIA_THUMB_MAX_EDGE = 640;

/** Если «превью» больше этого — это копия оригинала, его надо пережать. */
export const MEDIA_THUMB_MAX_BYTES = 220_000;

export async function createJpegThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(MEDIA_THUMB_MAX_EDGE, MEDIA_THUMB_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

export function shouldRebuildThumbnail(params: {
  type: MediaType;
  fileUrl: string;
  thumbnailUrl: string | null;
  thumbnailSize?: number | null;
}): boolean {
  if (params.type !== MediaType.PHOTO) return false;
  if (!params.thumbnailUrl || params.thumbnailUrl === params.fileUrl) return true;
  if (params.thumbnailSize != null && params.thumbnailSize > MEDIA_THUMB_MAX_BYTES) return true;
  return false;
}
