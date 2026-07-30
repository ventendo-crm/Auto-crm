import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { ensureClientStageMessages } from "@/lib/services/client-stage-messages";
import { ensureEmailTemplates } from "@/lib/email/template-store";
import { ensureTelegramTemplates } from "@/lib/telegram/template-store";
import { getRoleByName } from "@/lib/services/roles";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export async function listCompanies() {
  return prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      telegramBotUsername: true,
      telegramConnectedAt: true,
      createdAt: true,
      _count: { select: { users: true, deals: true } },
    },
  });
}

export async function createCompanyWithAdmin(params: {
  name: string;
  slug?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  actorId: string;
}) {
  const name = params.name.trim();
  let slug = (params.slug?.trim() || slugify(name) || "company").toLowerCase();

  const existingSlug = await prisma.company.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const adminRole = await getRoleByName(ROLES.ADMIN);
  if (!adminRole) {
    throw new Error("ROLE_NOT_FOUND:ADMIN");
  }

  const email = params.adminEmail.toLowerCase().trim();

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: { name, slug },
    });

    await tx.user.create({
      data: {
        name: params.adminName.trim(),
        email,
        passwordHash: await hashPassword(params.adminPassword),
        roleId: adminRole.id,
        companyId: created.id,
        isPlatformAdmin: false,
      },
    });

    return created;
  });

  await Promise.all([
    ensureEmailTemplates(company.id),
    ensureTelegramTemplates(company.id),
    ensureClientStageMessages(company.id),
  ]);

  return prisma.company.findUniqueOrThrow({
    where: { id: company.id },
    select: {
      id: true,
      name: true,
      slug: true,
      telegramBotUsername: true,
      telegramConnectedAt: true,
      createdAt: true,
      _count: { select: { users: true, deals: true } },
    },
  });
}

export function serializeCompanyBotSettings(company: {
  id: string;
  name: string;
  slug: string;
  telegramBotToken: string | null;
  telegramBotId: string | null;
  telegramBotUsername: string | null;
  telegramBotName: string | null;
  telegramDefaultChatId: string | null;
  telegramConnectedAt: Date | null;
}) {
  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    connected: Boolean(company.telegramBotToken),
    botId: company.telegramBotId,
    botUsername: company.telegramBotUsername,
    botName: company.telegramBotName,
    defaultChatId: company.telegramDefaultChatId,
    connectedAt: company.telegramConnectedAt,
    hasToken: Boolean(company.telegramBotToken),
    tokenMasked: company.telegramBotToken
      ? `${company.telegramBotToken.slice(0, 8)}…${company.telegramBotToken.slice(-4)}`
      : null,
  };
}
