import { createHash, randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { getAppUrl, isEmailConfigured } from "@/lib/email/config";
import { buildHtmlFromText } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export class PasswordResetError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SMTP_NOT_CONFIGURED"
      | "MULTIPLE_ACCOUNTS"
      | "EMAIL_SEND_FAILED"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN",
    public readonly companies?: Array<{ slug: string; name: string }>,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createResetToken(): string {
  return randomBytes(32).toString("hex");
}

function formatPasswordResetEmail(params: {
  userName: string;
  companyName: string;
  resetUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Восстановление пароля — Auto-CRM";
  const text = [
    `Здравствуйте, ${params.userName}!`,
    "",
    `Вы запросили восстановление пароля для аккаунта в компании «${params.companyName}».`,
    "",
    "Перейдите по ссылке, чтобы задать новый пароль (ссылка действует 1 час):",
    params.resetUrl,
    "",
    "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
  ].join("\n");

  return {
    subject,
    text,
    html: buildHtmlFromText(
      "Восстановление пароля",
      text,
      "Задать новый пароль",
      params.resetUrl,
    ),
  };
}

export async function requestPasswordReset(params: {
  email: string;
  companySlug?: string;
}): Promise<{ message: string }> {
  const email = params.email.toLowerCase().trim();
  const companySlug = params.companySlug?.trim().toLowerCase() || undefined;

  const users = await prisma.user.findMany({
    where: {
      email,
      ...(companySlug ? { company: { slug: companySlug } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      company: { select: { name: true, slug: true } },
    },
  });

  // Не раскрываем, существует ли email.
  const genericOk = {
    message: "Если аккаунт найден, мы отправили письмо со ссылкой для сброса пароля.",
  };

  if (users.length === 0) {
    return genericOk;
  }

  if (users.length > 1 && !companySlug) {
    throw new PasswordResetError(
      "Укажите компанию — найдено несколько аккаунтов с этим email",
      "MULTIPLE_ACCOUNTS",
      users.map((user) => ({
        slug: user.company.slug,
        name: user.company.name,
      })),
    );
  }

  if (!isEmailConfigured()) {
    throw new PasswordResetError(
      "Отправка почты не настроена. Обратитесь к администратору платформы.",
      "SMTP_NOT_CONFIGURED",
    );
  }

  const user = users[0];
  const token = createResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: expiresAt,
    },
  });

  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const emailContent = formatPasswordResetEmail({
    userName: user.name,
    companyName: user.company.name,
    resetUrl,
  });

  const sent = await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!sent.ok) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });
    throw new PasswordResetError(
      "Не удалось отправить письмо. Попробуйте позже или обратитесь к администратору.",
      "EMAIL_SEND_FAILED",
    );
  }

  return genericOk;
}

export async function confirmPasswordReset(params: {
  token: string;
  password: string;
}): Promise<{ message: string }> {
  const tokenHash = hashResetToken(params.token.trim());

  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
    select: {
      id: true,
      passwordResetTokenExpiresAt: true,
    },
  });

  if (!user) {
    throw new PasswordResetError(
      "Ссылка недействительна или уже использована",
      "INVALID_TOKEN",
    );
  }

  if (
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt.getTime() < Date.now()
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });
    throw new PasswordResetError(
      "Срок действия ссылки истёк. Запросите восстановление снова.",
      "EXPIRED_TOKEN",
    );
  }

  const passwordHash = await hashPassword(params.password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  return { message: "Пароль обновлён. Теперь можно войти." };
}
