import { DocumentType } from "@prisma/client";
import { withAuth } from "@/lib/api-handler";
import { uploadContentDisposition } from "@/lib/storage/local-uploads";
import { streamDealDocumentFile } from "@/lib/services/documents";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DOCUMENT_TYPES = new Set<string>(Object.values(DocumentType));

export const GET = withAuth(async (request, { user, params }) => {
  if (!DOCUMENT_TYPES.has(params.type)) {
    throw new Error("Not found");
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const type = params.type as DocumentType;

  const { stream, contentType, fileName, size } = await streamDealDocumentFile(
    user,
    params.id,
    type,
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
