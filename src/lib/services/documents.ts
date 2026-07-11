import { DocumentStatus, DocumentType } from "@prisma/client";
import { unlink } from "fs/promises";
import { AuthUser, canDeleteDealDocuments, canUpdateDeal, canViewDeal } from "@/lib/permissions";
import { dealAccessSelect } from "@/lib/deal-managers";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/audit";
import { getManagerPeerIdsForUser } from "@/lib/services/deal-access";
import {
  isLocalUploadUrl,
  localUploadFilePath,
  openLocalUploadFile,
} from "@/lib/storage/local-uploads";

export function buildDocumentFileUrl(
  dealId: string,
  type: DocumentType,
  download = false,
): string {
  const base = `/api/deals/${dealId}/documents/${type}/file`;
  return download ? `${base}?download=1` : base;
}

export async function updateDocumentStatus(
  user: AuthUser,
  dealId: string,
  type: DocumentType,
  status: DocumentStatus,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: dealAccessSelect,
  });

  if (!deal) {
    throw new Error("Not found");
  }

  if (!canUpdateDeal(user.role, user.id, deal)) {
    throw new Error("Forbidden");
  }

  const document = await prisma.document.findUnique({
    where: { dealId_type: { dealId, type } },
  });

  if (!document?.fileUrl) {
    throw new Error("Not found");
  }

  if (status === DocumentStatus.VERIFIED && document.status === DocumentStatus.MISSING) {
    throw new Error("Документ не загружен");
  }

  const updated = await prisma.document.update({
    where: { dealId_type: { dealId, type } },
    data: { status },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Document",
    entityId: updated.id,
    action: "UPDATE",
    oldValue: { status: document.status },
    newValue: { status },
  });

  return updated;
}

export async function deleteDealDocument(user: AuthUser, dealId: string, type: DocumentType) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: dealAccessSelect,
  });

  if (!deal) {
    throw new Error("Not found");
  }

  if (!canDeleteDealDocuments(user.role, user.id, deal)) {
    throw new Error("Forbidden");
  }

  const document = await prisma.document.findUnique({
    where: { dealId_type: { dealId, type } },
  });

  if (!document?.fileUrl) {
    throw new Error("Not found");
  }

  if (isLocalUploadUrl(document.fileUrl)) {
    await unlink(localUploadFilePath(document.fileUrl)).catch(() => undefined);
  }

  const updated = await prisma.document.update({
    where: { dealId_type: { dealId, type } },
    data: {
      fileUrl: null,
      status: DocumentStatus.MISSING,
      uploadedById: null,
      uploadedAt: null,
    },
  });

  await createAuditLog({
    userId: user.id,
    entity: "Document",
    entityId: updated.id,
    action: "DELETE",
    oldValue: { dealId, type, fileUrl: document.fileUrl },
  });

  return updated;
}

export async function streamDealDocumentFile(
  user: AuthUser,
  dealId: string,
  type: DocumentType,
  download = false,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: dealAccessSelect,
  });

  if (!deal) {
    throw new Error("Not found");
  }

  if (!canViewDeal(user.role, user.id, deal, await getManagerPeerIdsForUser(user))) {
    throw new Error("Forbidden");
  }

  const document = await prisma.document.findUnique({
    where: {
      dealId_type: { dealId, type },
    },
  });

  if (!document?.fileUrl) {
    throw new Error("Not found");
  }

  if (!isLocalUploadUrl(document.fileUrl)) {
    throw new Error("Not found");
  }

  const file = await openLocalUploadFile(document.fileUrl);

  return {
    ...file,
    download,
  };
}
