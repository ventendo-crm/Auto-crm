import { Prisma } from "@prisma/client";
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
import { type SearchProcessEntryEstimateItem } from "@/lib/services/search-process-entry-estimates";
import { notifyClientSearchProcessVariantPublished } from "@/lib/services/notifications";
import { normalizeExternalUrl } from "@/lib/validators/search-process-links";

export interface SearchProcessLinks {
  inspectionLink: string | null;
  chinaAutotecaLink: string | null;
  exchangeRate: number | null;
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
  customsEstimate: {
    include: {
      createdBy: {
        select: { name: true },
      },
    },
  },
} as const;

async function serializeEntry(
  entry: {
    id: string;
    dealId: string;
    description: string;
    clientFeedback: string | null;
    clientFeedbackAt: Date | null;
    publishedAt: Date | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    media: Parameters<typeof enrichMediaRecord>[0][];
    customsEstimate?: {
      id: string;
      searchProcessEntryId: string;
      createdById: string;
      createdAt: Date;
      updatedAt: Date;
      price: { toNumber(): number };
      currency: string;
      powerHp: number;
      volumeCc: number;
      carYear: number;
      note: string | null;
      input: unknown;
      result: unknown;
      totalWithCar: { toNumber(): number };
      createdBy: { name: string };
    } | null;
  },
) {
  return {
    id: entry.id,
    dealId: entry.dealId,
    description: entry.description,
    clientFeedback: entry.clientFeedback,
    clientFeedbackAt: entry.clientFeedbackAt?.toISOString() ?? null,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    media: await Promise.all(entry.media.map(enrichMediaRecord)),
    estimate: (entry.customsEstimate
      ? {
          id: entry.customsEstimate.id,
          searchProcessEntryId: entry.customsEstimate.searchProcessEntryId,
          createdById: entry.customsEstimate.createdById,
          createdByName: entry.customsEstimate.createdBy.name,
          createdAt: entry.customsEstimate.createdAt.toISOString(),
          updatedAt: entry.customsEstimate.updatedAt.toISOString(),
          price: entry.customsEstimate.price.toNumber(),
          currency: entry.customsEstimate.currency,
          powerHp: entry.customsEstimate.powerHp,
          volumeCc: entry.customsEstimate.volumeCc,
          carYear: entry.customsEstimate.carYear,
          note: entry.customsEstimate.note,
          input: entry.customsEstimate.input,
          result: entry.customsEstimate.result,
          totalWithCar: entry.customsEstimate.totalWithCar.toNumber(),
        }
      : null) as SearchProcessEntryEstimateItem | null,
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
    select: { inspectionLink: true, chinaAutotecaLink: true, searchProcessExchangeRate: true },
  });

  if (!deal) {
    throw new Error("Not found");
  }

  return {
    inspectionLink: deal.inspectionLink,
    chinaAutotecaLink: deal.chinaAutotecaLink,
    exchangeRate:
      deal.searchProcessExchangeRate != null ? deal.searchProcessExchangeRate.toNumber() : null,
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
    select: { inspectionLink: true, chinaAutotecaLink: true, searchProcessExchangeRate: true },
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
  const searchProcessExchangeRate =
    input.exchangeRate !== undefined
      ? input.exchangeRate != null
        ? new Prisma.Decimal(input.exchangeRate)
        : null
      : existing.searchProcessExchangeRate;

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { inspectionLink, chinaAutotecaLink, searchProcessExchangeRate },
    select: { inspectionLink: true, chinaAutotecaLink: true, searchProcessExchangeRate: true },
  });

  if (
    existing.inspectionLink !== deal.inspectionLink ||
    existing.chinaAutotecaLink !== deal.chinaAutotecaLink ||
    (existing.searchProcessExchangeRate?.toString() ?? null) !==
      (deal.searchProcessExchangeRate?.toString() ?? null)
  ) {
    await createAuditLog({
      userId: user.id,
      entity: "Deal",
      entityId: dealId,
      action: "SEARCH_LINKS_UPDATE",
      oldValue: {
        inspectionLink: existing.inspectionLink,
        chinaAutotecaLink: existing.chinaAutotecaLink,
        exchangeRate:
          existing.searchProcessExchangeRate != null
            ? existing.searchProcessExchangeRate.toNumber()
            : null,
      },
      newValue: {
        inspectionLink: deal.inspectionLink,
        chinaAutotecaLink: deal.chinaAutotecaLink,
        exchangeRate:
          deal.searchProcessExchangeRate != null ? deal.searchProcessExchangeRate.toNumber() : null,
      },
    });
  }

  return {
    inspectionLink: deal.inspectionLink,
    chinaAutotecaLink: deal.chinaAutotecaLink,
    exchangeRate:
      deal.searchProcessExchangeRate != null ? deal.searchProcessExchangeRate.toNumber() : null,
  };
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

async function loadSearchProcessEntryForClientNotify(dealId: string, entryId: string) {
  return prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
    include: {
      media: {
        orderBy: { uploadedAt: "asc" as const },
        select: { fileUrl: true, fileName: true, type: true },
      },
      customsEstimate: { select: { totalWithCar: true } },
    },
  });
}

/** Первая публикация варианта клиенту (кабинет + Telegram). */
export async function publishSearchProcessEntryToClient(
  user: AuthUser,
  dealId: string,
  entryId: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
    include: { _count: { select: { media: true } } },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  if (existing.publishedAt) {
    throw new Error("ALREADY_PUBLISHED");
  }

  if (existing._count.media === 0) {
    throw new Error("MEDIA_REQUIRED");
  }

  const publishedAt = new Date();
  const entry = await prisma.searchProcessEntry.update({
    where: { id: entryId },
    data: { publishedAt },
    include: entryInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entryId,
    action: "PUBLISH",
    newValue: {
      dealId,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
      publishedAt: publishedAt.toISOString(),
    },
  });

  const forNotify = await loadSearchProcessEntryForClientNotify(dealId, entryId);
  if (forNotify) {
    await notifyClientSearchProcessVariantPublished({
      dealId,
      entryId,
      variantNumber: forNotify.sortOrder + 1,
      description: forNotify.description,
      totalWithCar:
        forNotify.customsEstimate?.totalWithCar != null
          ? Number(forNotify.customsEstimate.totalWithCar)
          : null,
      media: forNotify.media.map((item) => ({
        fileKey: item.fileUrl,
        fileName: item.fileName,
        type: item.type,
      })),
      isUpdate: false,
    });
  }

  return serializeEntry(entry);
}

/** Повторная отправка актуальных данных варианта клиенту в Telegram. */
export async function notifyClientSearchProcessEntryUpdate(
  user: AuthUser,
  dealId: string,
  entryId: string,
) {
  await assertDealMediaAccess(user, dealId, true);

  const existing = await prisma.searchProcessEntry.findFirst({
    where: { id: entryId, dealId },
    include: { _count: { select: { media: true } } },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  if (!existing.publishedAt) {
    throw new Error("NOT_PUBLISHED");
  }

  if (existing._count.media === 0) {
    throw new Error("MEDIA_REQUIRED");
  }

  const forNotify = await loadSearchProcessEntryForClientNotify(dealId, entryId);
  if (!forNotify) {
    throw new Error("NOT_FOUND");
  }

  await notifyClientSearchProcessVariantPublished({
    dealId,
    entryId,
    variantNumber: forNotify.sortOrder + 1,
    description: forNotify.description,
    totalWithCar:
      forNotify.customsEstimate?.totalWithCar != null
        ? Number(forNotify.customsEstimate.totalWithCar)
        : null,
    media: forNotify.media.map((item) => ({
      fileKey: item.fileUrl,
      fileName: item.fileName,
      type: item.type,
    })),
    isUpdate: true,
  });

  await createAuditLog({
    userId: user.id,
    entity: "SearchProcessEntry",
    entityId: entryId,
    action: "CLIENT_NOTIFY",
    newValue: {
      dealId,
      sortOrder: existing.sortOrder,
      variantNumber: existing.sortOrder + 1,
    },
  });

  return serializeEntry(await prisma.searchProcessEntry.findFirstOrThrow({
    where: { id: entryId },
    include: entryInclude,
  }));
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
