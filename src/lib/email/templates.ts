import { getAppUrl } from "@/lib/email/config";
import { buildHtmlFromText, renderTemplateString } from "@/lib/email/render";
import { getEmailTemplateRecord } from "@/lib/email/template-store";

export const EMAIL_TEMPLATE_PLACEHOLDERS = {
  CLIENT_STAGE: ["stageLabel", "body", "carLine", "vinLine", "portalUrl"],
  CLIENT_COMMENT: ["clientName", "vin", "authorName", "authorRole", "commentText", "portalUrl"],
  CLIENT_TEST: ["userName"],
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_PLACEHOLDERS;

export async function formatClientStageEmail(params: {
  stageLabel: string;
  body: string;
  carLabel?: string | null;
  vin?: string | null;
}): Promise<{ subject: string; text: string; html: string }> {
  const template = await getEmailTemplateRecord("CLIENT_STAGE");
  const portalUrl = `${getAppUrl()}/my-deal`;
  const vars = {
    stageLabel: params.stageLabel,
    body: params.body,
    carLine: params.carLabel?.trim() ? `Автомобиль: ${params.carLabel.trim()}` : "",
    vinLine: params.vin?.trim() ? `VIN: ${params.vin.trim()}` : "",
    portalUrl,
  };

  const subject = renderTemplateString(template.subject, vars);
  const text = renderTemplateString(template.textBody, vars).trim();
  const htmlTitle = renderTemplateString(template.htmlTitle, vars);

  return {
    subject,
    text,
    html: buildHtmlFromText(htmlTitle, text, "Открыть личный кабинет", portalUrl),
  };
}

export async function formatClientCommentEmail(params: {
  clientName: string;
  vin: string;
  authorName: string;
  authorRole: string;
  text: string;
}): Promise<{ subject: string; text: string; html: string }> {
  const template = await getEmailTemplateRecord("CLIENT_COMMENT");
  const portalUrl = `${getAppUrl()}/my-deal`;
  const commentText =
    params.text.length > 500 ? `${params.text.slice(0, 500).trim()}…` : params.text;

  const vars = {
    clientName: params.clientName,
    vin: params.vin,
    authorName: params.authorName,
    authorRole: params.authorRole,
    commentText,
    portalUrl,
  };

  const subject = renderTemplateString(template.subject, vars);
  const text = renderTemplateString(template.textBody, vars).trim();
  const htmlTitle = renderTemplateString(template.htmlTitle, vars);

  return {
    subject,
    text,
    html: buildHtmlFromText(htmlTitle, text, "Открыть личный кабинет", portalUrl),
  };
}

export async function formatTestEmail(
  userName: string,
): Promise<{ subject: string; text: string; html: string }> {
  const template = await getEmailTemplateRecord("CLIENT_TEST");
  const vars = { userName };

  const subject = renderTemplateString(template.subject, vars);
  const text = renderTemplateString(template.textBody, vars).trim();
  const htmlTitle = renderTemplateString(template.htmlTitle, vars);

  return {
    subject,
    text,
    html: buildHtmlFromText(htmlTitle, text),
  };
}
