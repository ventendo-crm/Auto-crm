import { z } from "zod";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "@/lib/email/templates";

const templateKeys = Object.keys(EMAIL_TEMPLATE_PLACEHOLDERS) as [
  keyof typeof EMAIL_TEMPLATE_PLACEHOLDERS,
  ...Array<keyof typeof EMAIL_TEMPLATE_PLACEHOLDERS>,
];

export const emailTemplateKeySchema = z.enum(templateKeys);

export const updateEmailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  textBody: z.string().min(1).max(10000),
  htmlTitle: z.string().min(1).max(200),
});
