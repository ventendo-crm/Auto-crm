import { withAuth } from "@/lib/api-handler";
import { streamMediaFile } from "@/lib/services/media";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function contentDisposition(fileName: string, download: boolean): string {
  const encoded = encodeURIComponent(fileName);
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

function mediaFileHeaders(params: {
  contentType: string;
  fileName: string;
  download: boolean;
  size: number;
  etag: string;
  immutable?: boolean;
  rangeStart?: number;
  rangeEnd?: number;
  unsatisfiable?: boolean;
}): Headers {
  const cacheControl = params.immutable
    ? "private, max-age=31536000, immutable"
    : "private, max-age=86400";
  const headers = new Headers({
    "Content-Type": params.contentType,
    "Content-Disposition": contentDisposition(params.fileName, params.download),
    "Cache-Control": cacheControl,
    ETag: params.etag,
    "Accept-Ranges": "bytes",
  });

  if (params.unsatisfiable) {
    headers.set("Content-Range", `bytes */${params.size}`);
    return headers;
  }

  if (params.rangeStart != null && params.rangeEnd != null) {
    headers.set(
      "Content-Range",
      `bytes ${params.rangeStart}-${params.rangeEnd}/${params.size}`,
    );
    headers.set("Content-Length", String(params.rangeEnd - params.rangeStart + 1));
    return headers;
  }

  headers.set("Content-Length", String(params.size));
  return headers;
}

export const GET = withAuth(async (request, { user, params }) => {
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "full";
  const download = url.searchParams.get("download") === "1";

  const file = await streamMediaFile(
    user,
    params.id,
    variant,
    request.headers.get("range"),
  );
  const etag = `"${params.id}-${variant}-${file.size}"`;
  const immutable = variant === "thumb" && file.status === 200 && !download;

  if (file.status === 416) {
    return new NextResponse(null, {
      status: 416,
      headers: mediaFileHeaders({
        contentType: file.contentType,
        fileName: file.fileName,
        download,
        size: file.size,
        etag,
        unsatisfiable: true,
      }),
    });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (file.status === 200 && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: mediaFileHeaders({
        contentType: file.contentType,
        fileName: file.fileName,
        download,
        size: file.size,
        etag,
        immutable,
      }),
    });
  }

  return new NextResponse(file.stream, {
    status: file.status,
    headers: mediaFileHeaders({
      contentType: file.contentType,
      fileName: file.fileName,
      download,
      size: file.size,
      etag,
      immutable,
      rangeStart: file.range?.start,
      rangeEnd: file.range?.end,
    }),
  });
});
