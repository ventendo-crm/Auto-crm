export const EMAIL_TEMPLATE_PLACEHOLDERS = {
  CLIENT_STAGE: ["stageLabel", "body", "carLine", "vinLine", "portalUrl"],
  CLIENT_COMMENT: ["clientName", "vin", "authorName", "authorRole", "commentText", "portalUrl"],
  CLIENT_TEST: ["userName"],
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_PLACEHOLDERS;
