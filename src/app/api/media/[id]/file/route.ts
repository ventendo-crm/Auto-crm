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
  rangeStart?: number;
  rangeEnd?: number;
  unsatisfiable?: boolean;
}): Headers {
  const headers = new Headers({
    "Content-Type": params.contentType,
    "Content-Disposition": contentDisposition(params.fileName, params.download),
    "Cache-Control": "private, max-age=3600",
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

  if (file.status === 416) {
    return new NextResponse(null, {
      status: 416,
      headers: mediaFileHeaders({
        contentType: file.contentType,
        fileName: file.fileName,
        download,
        size: file.size,
        unsatisfiable: true,
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
      rangeStart: file.range?.start,
      rangeEnd: file.range?.end,
    }),
  });
});
