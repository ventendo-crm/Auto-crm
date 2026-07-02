import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { getEmailFrom, isEmailConfigured } from "@/lib/email/config";

export interface EmailSendResult {
  ok: boolean;
  to: string;
  error?: string;
}

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT?.trim() || "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim(),
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASSWORD ?? "",
      },
    });
  }

  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailSendResult> {
  const to = params.to.trim().toLowerCase();
  const transport = getTransporter();

  if (!transport) {
    console.warn("[email] skipped: SMTP is not configured");
    return { ok: false, to, error: "SMTP is not configured" };
  }

  const from = getEmailFrom();

  try {
    await transport.sendMail({
      from: `"${from.name}" <${from.address}>`,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return { ok: true, to };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("[email] send failed:", message, "to=", to);
    return { ok: false, to, error: message };
  }
}

export async function sendEmailToClientUser(
  userId: string,
  params: {
    subject: string;
    text: string;
    html: string;
  },
): Promise<EmailSendResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: { select: { name: true } },
    },
  });

  if (!user || user.role.name !== ROLES.CLIENT) {
    return null;
  }

  return sendEmail({
    to: user.email,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
