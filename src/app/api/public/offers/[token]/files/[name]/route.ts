import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-handler";
import { error } from "@/lib/api-response";
import { openPublicOfferFile, uploadContentDisposition } from "@/lib/services/calculator-offers";

export const runtime = "nodejs";

export const GET = withPublic(async (_request, { params }) => {
  try {
    const file = await openPublicOfferFile(params.token, params.name);
    return new NextResponse(file.stream, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": uploadContentDisposition(file.downloadName, false),
        "Cache-Control": "public, max-age=86400, immutable",
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
