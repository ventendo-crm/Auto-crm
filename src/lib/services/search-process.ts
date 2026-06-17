import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import {
  assertDealMediaAccess,
  deleteMedia,
  enrichMediaRecord,
  SEARCH_PROCESS_MEDIA_INCLUDE,
  uploadDealMedia,
} from "@/lib/services/media";
import { normalizeExternalUrl } from "@/lib/validators/search-process-links";

export interface SearchProcessLinks {
  inspectionLink: string | null;
  chinaAutotecaLink: string | null;
}

export interface SearchProcessData {
  entries: Awaited<ReturnType<typeof listSearchProcessEntries>>;
  links: SearchProcessLinks;
}
const entryInclude = {
  media: {
    orderBy: { uploadedAt: "asc" as const },
    include: SEARCH_PROCESS_MEDIA_INCLUDE,
  },
} as const;

async function serializeEntry(
  entry: {
    id: string;
    dealId: string;
    description: string;
    clientFeedback: string | null;
    clientFeedbackAt: Date | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    media: Parameters<typeof enrichMediaRecord>[0][];
  },
) {
  return {
    id: entry.id,
    dealId: entry.dealId,
    description: entry.description,
    clientFeedback: entry.clientFeedback,
    clientFeedbackAt: entry.clientFeedbackAt?.toISOString() ?? null,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    media: await Promise.all(entry.media.map(enrichMediaRecord)),
  };
}

export async function listSearchProcessEntries(user: AuthUser, dealId: string) {
  await assertDealMediaAccess(user, dealId);

  const entries = await prisma.searchProcessEntry.findMany({
    where: { dealId },
    orderBy: { sortOrder: "asc" },
    include: entryInclude,
  });

  return Promise.all(entries.map(serializeEntry));
}

export async function getSearchProcessLinks(
  user: AuthUser,
  dealId: string,
): Promise<SearchProcessLinks> {
  await assertDealMediaAccess(user, dealId);

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { inspectionLink: true, chinaAutotecaLink: true },
  });

  if (!deal) {
    throw new Error("Not found");
  }

  return {
    inspectionLink: deal.inspectionLink,
    chinaAutotecaLink: deal.chinaAutotecaLink,
  };
}

export async function updateSearchProcessLinks(
  user: AuthUser,
  dealId: string,
  input: Partial<SearchProcessLinks>,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { inspectionLink: true, chinaAutotecaLink: true },
  });

  if (!existing) {
    throw new Error("Not found");
  }

  const inspectionLink =
    input.inspectionLink !== undefined
      ? normalizeExternalUrl(input.inspectionLink)
      : existing.inspectionLink;
  const chinaAutotecaLink =
    input.chinaAutotecaLink !== undefined
      ? normalizeExternalUrl(input.chinaAutotecaLink)
      : existing.chinaAutotecaLink;

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { inspectionLink, chinaAutotecaLink },
    select: { inspectionLink: true, chinaAutotecaLink: true },
  });

  if (
    existing.inspectionLink !== deal.inspectionLink ||
    existing.chinaAutotecaLink !== deal.chinaAutotecaLink
  ) {
    await createAuditLog({
      userId: user.id,
      entity: "Deal",
      entityId: dealId,
      action: "SEARCH_LINKS_UPDATE",
      oldValue: {
        inspectionLink: existing.inspectionLink,
        chinaAutotecaLink: existing.chinaAutotecaLink,
      },
      newValue: {
        inspectionLink: deal.inspectionLink,
        chinaAutotecaLink: deal.chinaAutotecaLink,
      },
    });
  }

  return deal;
}

export async function listSearchProcess(user: AuthUser, dealId: string): Promise<SearchProcessData> {
  const [entries, links] = await Promise.all([
    listSearchProcessEntries(user, dealId),
    getSearchProcessLinks(user, dealId),
  ]);

  return { entries, links };
}

export async function createSearchProcessEntry(user: AuthUser, dealId: string) {  await assertDealMediaAccess(user, dealId, true);

  const last = await prisma.searchProcessEntry.findFirst({
    where: { dealId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const entry = await prisma.searchProcessEntry.create({
    data: {
      dealId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entry.id,
    action: "CREATE",
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
    },
  });

  return serializeEntry(entry);}

export async function updateSearchProcessEntry(
  user: AuthUser,
  dealId: string,
  entryId: string,
  description: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
  });

  if (!existing) {
    throw new Error("Not found");
  }

  const entry = await prisma.searchProcessEntry.update({
    where: { id: entryId },
    data: { description },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entryId,
    action: "UPDATE",
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
      description,
    },
  });

  return serializeEntry(entry);}

export async function deleteSearchProcessEntry(
  user: AuthUser,
  dealId: string,
  entryId: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const entry = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
    include: { media: true },
  });

  if (!entry) {
    throw new Error("Not found");
  }

  for (const item of entry.media) {
    await deleteMedia(user, item.id);
  }

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entryId,
    action: "DELETE",
    oldValue: {
      dealId,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
    },
  });

  await prisma.searchProcessEntry.delete({ where: { id: entryId } });}

export async function uploadSearchProcessMedia(
  user: AuthUser,
  dealId: string,
  entryId: string,
  file: File,
) {
  return uploadDealMedia(user, dealId, file, { searchProcessEntryId: entryId });
}

export async function submitSearchProcessClientFeedback(
  user: AuthUser,
  dealId: string,
  entryId: string,
  feedback: string,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, clientUserId: true },
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  if (user.role !== ROLES.CLIENT || deal.clientUserId !== user.id) {
    throw new Error("FORBIDDEN");
  }

  const existing = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const entry = await prisma.searchProcessEntry.update({
    where: { id: entryId },
    data: {
      clientFeedback: feedback,
      clientFeedbackAt: new Date(),
    },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entryId,
    action: "CLIENT_FEEDBACK",
    oldValue: {
      dealId,
      sortOrder: existing.sortOrder,
      variantNumber: existing.sortOrder + 1,
      clientFeedback: existing.clientFeedback,
    },
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
      clientFeedback: feedback,
    },
  });

  return serializeEntry(entry);
}
