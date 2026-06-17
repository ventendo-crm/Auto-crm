import { DocumentType } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { assertAllowed, assertFound, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canUploadDealDocuments } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

const ALLOWED_TYPES = new Set<string>(Object.values(DocumentType));

const uploadSchema = z.object({
  dealId: z.string().min(1),
  type: z.nativeEnum(DocumentType),
});

export const POST = withAuth(async (request, { user }) => {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Файл не выбран");
  }

  const { dealId, type } = uploadSchema.parse({
    dealId: formData.get("dealId"),
    type: formData.get("type"),
  });

  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Недопустимый тип документа");
  }

  const deal = assertFound(await getDeal(dealId));
  assertAllowed(
    canUploadDealDocuments(user.role, user.id, {
      managerId: deal.managerId,
      clientUserId: deal.clientUserId,
    }),
  );

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeName = file.name.replace(/[^\w.\-()а-яА-ЯёЁ ]+/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const uploadsDir = path.join(process.cwd(), "uploads");

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, storedName), buffer);

  const fileUrl = `/api/uploads/${storedName}`;
  const now = new Date();

  const document = await prisma.document.upsert({
    where: {
      dealId_type: { dealId, type },
    },
    update: {
      fileUrl,
      status: "RECEIVED",
      uploadedById: user.id,
      uploadedAt: now,
    },
    create: {
      dealId,
      type,
      status: "RECEIVED",
      fileUrl,
      uploadedById: user.id,
      uploadedAt: now,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Document",
    entityId: document.id,
    action: "UPLOAD",
    newValue: { dealId, type, fileName: file.name },
  });

  return ok(serialize(document));
});
