import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-handler";
import { error } from "@/lib/api-response";
import { getPublicCatalogVehicleMedia } from "@/lib/services/catalog-vehicle-share";
import { openStoredMediaFile } from "@/lib/storage/media-storage";
import { uploadContentDisposition } from "@/lib/storage/local-uploads";

export const runtime = "nodejs";

export const GET = withPublic(async (_request, { params }) => {
  try {
    const media = await getPublicCatalogVehicleMedia(params.token, params.mediaId);
    const file = await openStoredMediaFile(media.fileUrl, media.fileName);
    if (file.status === 416 || !file.stream) {
      return error("Файл не найден", 404);
    }
    return new NextResponse(file.stream, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": uploadContentDisposition(file.fileName, false),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND" || err.message === "Not found") {
        return error("Файл не найден", 404);
      }
      if (err.message === "EXPIRED") return error("Ссылка истекла", 410);
    }
    throw err;
  }
});
