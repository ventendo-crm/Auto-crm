import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { assertAllowed, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyAppearance } from "@/lib/permissions";
import {
  clearCompanyAppearanceLogo,
  getCompanyAppearance,
  setCompanyAppearanceLogo,
} from "@/lib/services/company-appearance";
import {
  guessUploadContentType,
  isLocalUploadUrl,
  localUploadsDir,
  openLocalUploadFile,
  uploadContentDisposition,
} from "@/lib/storage/local-uploads";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

export const GET = withAuth(async (_request, { user }) => {
  const settings = await getCompanyAppearance(user.companyId);
  if (!settings.logoUrl || !isLocalUploadUrl(settings.logoUrl)) {
    return error("Логотип не найден", 404);
  }

  try {
    const file = await openLocalUploadFile(settings.logoUrl, "logo");
    return new NextResponse(file.stream, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Content-Disposition": uploadContentDisposition(file.fileName, false),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return error("Логотип не найден", 404);
  }
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyAppearance(user.role));

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return error("Файл не выбран");
  }

  if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    return error("Размер логотипа должен быть до 2 МБ");
  }

  const mime = file.type || guessUploadContentType(file.name);
  if (!ALLOWED_MIME.has(mime)) {
    return error("Допустимы PNG, JPEG или WebP");
  }

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const storedName = `company-logo-${user.companyId}-${Date.now()}.${ext}`;
  const uploadsDir = localUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, storedName), buffer);

  const fileUrl = `/api/uploads/${storedName}`;
  return ok(await setCompanyAppearanceLogo(user.companyId, fileUrl));
});

export const DELETE = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyAppearance(user.role));
  return ok(await clearCompanyAppearanceLogo(user.companyId));
});
