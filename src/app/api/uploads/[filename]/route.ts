import { withAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { canViewDeal } from "@/lib/permissions";
import {
  displayStoredFileName,
  guessUploadContentType,
  openLocalUploadFile,
  uploadContentDisposition,
} from "@/lib/storage/local-uploads";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";

async function assertUploadAccess(user: import("@/lib/permissions").AuthUser, filename: string) {
  const fileUrl = `/api/uploads/${path.basename(filename)}`;

  const document = await prisma.document.findFirst({
    where: { fileUrl },
    select: {
      deal: {
        select: { managerId: true, clientUserId: true },
      },
    },
  });

  if (document) {
    if (!canViewDeal(user.role, user.id, document.deal)) {
      throw new Error("Forbidden");
    }
    return;
  }

  const media = await prisma.mediaFile.findFirst({
    where: {
      OR: [{ fileUrl }, { thumbnailUrl: fileUrl }],
    },
    select: {
      deal: {
        select: { managerId: true, clientUserId: true },
      },
    },
  });

  if (media?.deal) {
    if (!canViewDeal(user.role, user.id, media.deal)) {
      throw new Error("Forbidden");
    }
    return;
  }

  if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export const GET = withAuth(async (request, { user, params }) => {
  const safeName = path.basename(params.filename);
  const fileUrl = `/api/uploads/${safeName}`;
  const download = new URL(request.url).searchParams.get("download") === "1";

  await assertUploadAccess(user, safeName);

  const { stream, size } = await openLocalUploadFile(
    fileUrl,
    displayStoredFileName(safeName),
  );

  const headers = new Headers({
    "Content-Type": guessUploadContentType(safeName),
    "Content-Disposition": uploadContentDisposition(displayStoredFileName(safeName), download),
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(size),
  });

  return new NextResponse(stream, { status: 200, headers });
});
