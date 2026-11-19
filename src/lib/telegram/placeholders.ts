export const TELEGRAM_TEMPLATE_PLACEHOLDERS = {
  STAGE_CHANGE: [
    "clientName",
    "vin",
    "fromStage",
    "toStage",
    "managerName",
    "changedByName",
    "date",
  ],
  CLIENT_STAGE: ["stageLabel", "body", "carLine", "vinLine"],
  COMMENT: ["clientName", "vin", "authorName", "authorRole", "commentText"],
  TRACKING_POINT: ["pointTitle", "pointDescription", "recordedAt"],
  TEST: ["userName"],
} as const;

export type TelegramTemplateKey = keyof typeof TELEGRAM_TEMPLATE_PLACEHOLDERS;
