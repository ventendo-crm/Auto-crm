import { withAuth } from "@/lib/api-handler";
import { isDocumentTypeKey } from "@/lib/company-workspace/helpers";
import { uploadContentDisposition } from "@/lib/storage/local-uploads";
import { streamDealDocumentFile } from "@/lib/services/documents";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAuth(async (request, { user, params }) => {
  if (!isDocumentTypeKey(params.type)) {
    throw new Error("Not found");
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";

  const { stream, contentType, fileName, size } = await streamDealDocumentFile(
    user,
    params.id,
    params.type,
    download,
  );

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": uploadContentDisposition(fileName, download),
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(size),
  });

  return new NextResponse(stream, { status: 200, headers });
});
