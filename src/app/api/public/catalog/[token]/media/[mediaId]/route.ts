import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-handler";
import { error } from "@/lib/api-response";
import { getPublicCatalogVehicleMedia } from "@/lib/services/catalog-vehicle-share";
import { openStoredMediaFile } from "@/lib/storage/media-storage";
import { uploadContentDisposition } from "@/lib/storage/local-uploads";

export const runtime = "nodejs";

function mediaHeaders(params: {
  contentType: string;
  fileName: string;
  size: number;
  rangeStart?: number;
  rangeEnd?: number;
  unsatisfiable?: boolean;
}): Headers {
  const headers = new Headers({
    "Content-Type": params.contentType,
    "Content-Disposition": uploadContentDisposition(params.fileName, false),
    "Cache-Control": "public, max-age=86400",
    "Accept-Ranges": "bytes",
  });

  if (params.unsatisfiable) {
    headers.set("Content-Range", `bytes */${params.size}`);
    return headers;
  }

  if (params.rangeStart != null && params.rangeEnd != null) {
    headers.set("Content-Range", `bytes ${params.rangeStart}-${params.rangeEnd}/${params.size}`);
    headers.set("Content-Length", String(params.rangeEnd - params.rangeStart + 1));
    return headers;
  }

  headers.set("Content-Length", String(params.size));
  return headers;
}

export const GET = withPublic(async (request, { params }) => {
  try {
    const media = await getPublicCatalogVehicleMedia(params.token, params.mediaId);
    const file = await openStoredMediaFile(
      media.fileUrl,
      media.fileName,
      request.headers.get("range"),
    );
    if (file.status === 416 || !file.stream) {
      return new NextResponse(null, {
        status: 416,
        headers: mediaHeaders({
          contentType: file.contentType,
          fileName: file.fileName,
          size: file.size,
          unsatisfiable: true,
        }),
      });
    }
    return new NextResponse(file.stream, {
      status: file.status,
      headers: mediaHeaders({
        contentType: file.contentType,
        fileName: file.fileName,
        size: file.size,
        rangeStart: file.range?.start,
        rangeEnd: file.range?.end,
      }),
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
