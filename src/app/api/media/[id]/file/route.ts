import { withAuth } from "@/lib/api-handler";
import { streamMediaFile } from "@/lib/services/media";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function contentDisposition(fileName: string, download: boolean): string {
  const encoded = encodeURIComponent(fileName);
  const type = download ? "attachment" : "inline";
  return `${type}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

export const GET = withAuth(async (request, { user, params }) => {
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "full";
  const download = url.searchParams.get("download") === "1";

  const { stream, contentType, fileName, size } = await streamMediaFile(
    user,
    params.id,
    variant,
  );

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition(fileName, download),
    "Cache-Control": "private, max-age=3600",
  });

  if (size !== undefined) {
    headers.set("Content-Length", String(size));
  }

  return new NextResponse(stream, { status: 200, headers });
});
