import { randomBytes } from "crypto";
import { dealManagersInclude, enrichDealWithManagers } from "@/lib/deal-managers";
import { hashPassword } from "@/lib/auth";
import { DOCUMENT_LABELS, STAGE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/services/audit";
import { enrichMediaRecord, SEARCH_PROCESS_MEDIA_INCLUDE } from "@/lib/services/media";
import { getRoleByName, ensureDefaultRoles } from "@/lib/services/roles";
import { deleteUser } from "@/lib/services/users";
import { serialize } from "@/lib/serialize";
import { resolveOriginLabel } from "@/lib/customs-calculator/custom-origins";
import { getCompanyCalculatorSettings } from "@/lib/services/company-calculator-settings";

const clientUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  telegramChatId: true,
} as const;

const TELEGRAM_LINK_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней

export function createTelegramLinkToken(): string {
  return randomBytes(16).toString("hex");
}

export function buildTelegramInviteUrl(botUsername: string, linkToken: string): string {
  const username = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${username}?start=link_${linkToken}`;
}

export async function issueTelegramLinkToken(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = createTelegramLinkToken();
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramLinkToken: token,
      telegramLinkTokenExpiresAt: expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getClientTelegramInvite(params: {
  dealId: string;
  companyId: string;
  refresh?: boolean;
}): Promise<{
  inviteUrl: string;
  botUsername: string;
  telegramLinked: boolean;
  telegramChatId: string | null;
  expiresAt: string;
}> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, companyId: params.companyId },
    select: {
      clientUserId: true,
      clientUser: {
        select: {
          id: true,
          telegramChatId: true,
          telegramLinkToken: true,
          telegramLinkTokenExpiresAt: true,
        },
      },
      company: {
        select: {
          telegramBotUsername: true,
          telegramBotToken: true,
        },
      },
    },
  });

  if (!deal?.clientUserId || !deal.clientUser) {
    throw new Error("CLIENT_NOT_LINKED");
  }

  const botUsername = deal.company.telegramBotUsername?.trim();
  if (!botUsername) {
    throw new Error("BOT_NOT_CONNECTED");
  }

  const telegramChatId = deal.clientUser.telegramChatId?.trim() || null;
  const telegramLinked = Boolean(telegramChatId);

  // Если Telegram уже привязан и не просят новую ссылку — просто статус + Chat ID
  if (telegramLinked && !params.refresh) {
    const existingToken = deal.clientUser.telegramLinkToken;
    const existingExpiry = deal.clientUser.telegramLinkTokenExpiresAt;
    if (existingToken && existingExpiry && existingExpiry > new Date()) {
      return {
        inviteUrl: buildTelegramInviteUrl(botUsername, existingToken),
        botUsername,
        telegramLinked: true,
        telegramChatId,
        expiresAt: existingExpiry.toISOString(),
      };
    }

    return {
      inviteUrl: "",
      botUsername,
      telegramLinked: true,
      telegramChatId,
      expiresAt: new Date().toISOString(),
    };
  }

  const now = new Date();
  const tokenValid =
    Boolean(deal.clientUser.telegramLinkToken) &&
    deal.clientUser.telegramLinkTokenExpiresAt &&
    deal.clientUser.telegramLinkTokenExpiresAt > now;

  const issued =
    params.refresh || !tokenValid
      ? await issueTelegramLinkToken(deal.clientUser.id)
      : {
          token: deal.clientUser.telegramLinkToken!,
          expiresAt: deal.clientUser.telegramLinkTokenExpiresAt!,
        };

  return {
    inviteUrl: buildTelegramInviteUrl(botUsername, issued.token),
    botUsername,
    telegramLinked,
    telegramChatId,
    expiresAt: issued.expiresAt.toISOString(),
  };
}

const galleryMediaInclude = {
  uploadedBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

export async function getDealByClientUserId(clientUserId: string) {
  return prisma.deal.findFirst({
    where: { clientUserId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      ...dealManagersInclude,
      clientUser: { select: clientUserSelect },
      documents: true,
      shipment: true,
      comments: {
        orderBy: { createdAt: "asc" as const },
        include: {
          author: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
        },
      },
      searchProcessEntries: {
        orderBy: { sortOrder: "asc" as const },
        include: {
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
        },
      },
      importProcessEntries: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          media: {
            orderBy: { uploadedAt: "asc" as const },
            include: SEARCH_PROCESS_MEDIA_INCLUDE,
          },
        },
      },
      carCarrierTrackingPoints: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          media: {
            orderBy: { uploadedAt: "asc" as const },
            include: SEARCH_PROCESS_MEDIA_INCLUDE,
          },
        },
      },
      media: {
        where: {
          searchProcessEntryId: null,
          importProcessEntryId: null,
          carCarrierTrackingPointId: null,
        },
        orderBy: { uploadedAt: "desc" as const },
        include: galleryMediaInclude,
      },
      stageHistory: {
        orderBy: { createdAt: "desc" as const },
        take: 20,
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function getClientPortalDeal(clientUserId: string) {
  const deal = await getDealByClientUserId(clientUserId);
  if (!deal) return null;

  const enrichedDeal = enrichDealWithManagers(deal);

  const searchProcess = await Promise.all(
    deal.searchProcessEntries.map(async (entry) => ({
      id: entry.id,
      description: entry.description,
      sortOrder: entry.sortOrder,
      variantNumber: entry.sortOrder + 1,
      clientFeedback: entry.clientFeedback,
      clientFeedbackAt: entry.clientFeedbackAt,
      media: await Promise.all(entry.media.map(enrichMediaRecord)),
      estimate: entry.customsEstimate
        ? {
            id: entry.customsEstimate.id,
            searchProcessEntryId: entry.customsEstimate.searchProcessEntryId,
            createdById: entry.customsEstimate.createdById,
            createdByName: entry.customsEstimate.createdBy.name,
            createdAt: entry.customsEstimate.createdAt.toISOString(),
            updatedAt: entry.customsEstimate.updatedAt.toISOString(),
            price: Number(entry.customsEstimate.price),
            currency: entry.customsEstimate.currency,
            powerHp: entry.customsEstimate.powerHp,
            volumeCc: entry.customsEstimate.volumeCc,
            carYear: entry.customsEstimate.carYear,
            note: entry.customsEstimate.note,
            input: entry.customsEstimate.input,
            result: entry.customsEstimate.result,
            totalWithCar: Number(entry.customsEstimate.totalWithCar),
          }
        : null,
    })),
  );

  const importProcess = await Promise.all(
    deal.importProcessEntries.map(async (entry) => ({
      id: entry.id,
      description: entry.description,
      sortOrder: entry.sortOrder,
      stageNumber: entry.sortOrder + 1,
      media: await Promise.all(entry.media.map(enrichMediaRecord)),
    })),
  );

  const carCarrierTracking = await Promise.all(
    deal.carCarrierTrackingPoints.map(async (point) => ({
      id: point.id,
      dealId: deal.id,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      title: point.title,
      description: point.description,
      recordedAt: point.recordedAt.toISOString(),
      sortOrder: point.sortOrder,
      createdAt: point.createdAt.toISOString(),
      updatedAt: point.updatedAt.toISOString(),
      media: await Promise.all(point.media.map(enrichMediaRecord)),
    })),
  );

  const carCarrierDestination =
    deal.carCarrierDestinationLat != null && deal.carCarrierDestinationLng != null
      ? {
          latitude: Number(deal.carCarrierDestinationLat),
          longitude: Number(deal.carCarrierDestinationLng),
          title: deal.carCarrierDestinationTitle || "Точка назначения",
        }
      : null;

  const media = await Promise.all(deal.media.map(enrichMediaRecord));

  const calculatorSettings = await getCompanyCalculatorSettings(deal.companyId);
  const destinationCountryLabel = resolveOriginLabel(
    deal.destinationCountry,
    calculatorSettings.customOrigins,
  );

  return serialize({
    id: deal.id,
    clientName: deal.clientName,
    vin: deal.vin,
    carBrand: deal.carBrand,
    carModel: deal.carModel,
    carYear: deal.carYear,
    destinationCity: deal.destinationCity,
    destinationCountry: destinationCountryLabel,
    currentStage: deal.currentStage,
    stageLabel: STAGE_LABELS[deal.currentStage],
    expectedArrival: deal.expectedArrival,
    actualArrival: deal.actualArrival,
    managerId: enrichedDeal.managerId,
    manager: enrichedDeal.manager,
    managers: enrichedDeal.managers,
    managerIds: enrichedDeal.managerIds,
    documents: deal.documents.map((doc) => ({
      id: doc.id,
      dealId: deal.id,
      type: doc.type,
      label: DOCUMENT_LABELS[doc.type as keyof typeof DOCUMENT_LABELS] ?? doc.type,
      status: doc.status,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt,
    })),
    shipment: deal.shipment,
    stageHistory: deal.stageHistory.map((item) => ({
      id: item.id,
      fromStage: item.fromStage,
      toStage: item.toStage,
      fromLabel: STAGE_LABELS[item.fromStage],
      toLabel: STAGE_LABELS[item.toStage],
      createdAt: item.createdAt,
    })),
    comments: deal.comments.map((comment) => ({
      id: comment.id,
      dealId: deal.id,
      text: comment.text,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
      author: comment.author,
    })),
    searchProcess,
    searchProcessLinks: {
      inspectionLink: deal.inspectionLink,
      chinaAutotecaLink: deal.chinaAutotecaLink,
      exchangeRate:
        deal.searchProcessExchangeRate != null ? deal.searchProcessExchangeRate.toNumber() : null,
    },
    importProcessEnabled: deal.importProcessEnabled,
    importProcess,
    carCarrierTracking,
    carCarrierDestination,
    media,
  });
}

export async function createClientAccount(
  actor: AuthUser,
  dealId: string,
  input: { name: string; email: string; password: string },
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, clientUserId: true, clientName: true, companyId: true },
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  if (deal.clientUserId) {
    throw new Error("CLIENT_ALREADY_LINKED");
  }

  await ensureDefaultRoles();

  const role = await getRoleByName("CLIENT");
  if (!role) {
    throw new Error("CLIENT_ROLE_NOT_FOUND");
  }

  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId: deal.companyId, email } },
  });
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);
  const linkToken = createTelegramLinkToken();
  const linkExpiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        roleId: role.id,
        companyId: deal.companyId,
        telegramLinkToken: linkToken,
        telegramLinkTokenExpiresAt: linkExpiresAt,
      },
      select: clientUserSelect,
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { clientUserId: created.id },
    });

    return created;
  });

  await createAuditLog({
    userId: actor.id,
    companyId: deal.companyId,
    entity: "User",
    entityId: user.id,
    action: "CREATE",
    newValue: { email: user.email, role: "CLIENT", dealId },
  });

  let telegramInvite: Awaited<ReturnType<typeof getClientTelegramInvite>> | null = null;
  try {
    telegramInvite = await getClientTelegramInvite({
      dealId,
      companyId: deal.companyId,
    });
  } catch {
    telegramInvite = null;
  }

  return { clientUser: user, telegramInvite };
}

export async function unlinkClientAccount(actor: AuthUser, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, clientUserId: true },
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  if (!deal.clientUserId) {
    throw new Error("CLIENT_NOT_LINKED");
  }

  await deleteUser({ actorId: actor.id, userId: deal.clientUserId });
}
