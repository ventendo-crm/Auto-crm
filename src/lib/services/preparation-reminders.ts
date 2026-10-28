import { DealStageType, NotificationType, PreparationReminderRecipientMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDealManagerIds } from "@/lib/deal-managers";
import { ROLES } from "@/lib/permissions";
import {
  DEFAULT_PREPARATION_REMINDER_TEMPLATE,
  isPreparationReminderDue,
  isStageReminderStage,
  preparationReminderVars,
  renderPreparationReminder,
  STAGE_REMINDER_STAGES,
} from "@/lib/preparation-reminders/message";
import { getCompanyStageLabels } from "@/lib/services/company-workspace";
import { createNotification } from "@/lib/services/notifications";
import {
  getCompanyTelegramConfig,
  isCompanyTelegramConfigured,
  sendCompanyTelegramMessages,
} from "@/lib/telegram/bot";
import type { PreparationReminderSettingsInput } from "@/lib/validators/preparation-reminder";

export interface PreparationReminderSettingsView {
  enabled: boolean;
  intervalHours: number;
  messageTemplate: string;
  recipientMode: "ASSIGNED" | "SPECIFIC";
  specificManagerId: string | null;
}

const defaultView = (): PreparationReminderSettingsView => ({
  enabled: false,
  intervalHours: 24,
  messageTemplate: DEFAULT_PREPARATION_REMINDER_TEMPLATE,
  recipientMode: "ASSIGNED",
  specificManagerId: null,
});

function toView(row: {
  enabled: boolean;
  intervalHours: number;
  messageTemplate: string;
  recipientMode: PreparationReminderRecipientMode;
  specificManagerId: string | null;
}): PreparationReminderSettingsView {
  return {
    enabled: row.enabled,
    intervalHours: row.intervalHours,
    messageTemplate: row.messageTemplate,
    recipientMode: row.recipientMode,
    specificManagerId: row.specificManagerId,
  };
}

export async function getPreparationReminderSettings(
  companyId: string,
): Promise<PreparationReminderSettingsView> {
  const row = await prisma.companyPreparationReminderSettings.findUnique({
    where: { companyId },
  });
  return row ? toView(row) : defaultView();
}

export async function savePreparationReminderSettings(
  companyId: string,
  input: PreparationReminderSettingsInput,
): Promise<PreparationReminderSettingsView> {
  if (input.recipientMode === "SPECIFIC" && input.specificManagerId) {
    const manager = await prisma.user.findFirst({
      where: {
        id: input.specificManagerId,
        companyId,
        role: { name: ROLES.MANAGER },
      },
      select: { id: true },
    });
    if (!manager) {
      throw new Error("Выберите менеджера своей компании");
    }
  }

  const row = await prisma.companyPreparationReminderSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      enabled: input.enabled,
      intervalHours: input.intervalHours,
      messageTemplate: input.messageTemplate,
      recipientMode: input.recipientMode,
      specificManagerId: input.specificManagerId,
    },
    update: {
      enabled: input.enabled,
      intervalHours: input.intervalHours,
      messageTemplate: input.messageTemplate,
      recipientMode: input.recipientMode,
      specificManagerId: input.specificManagerId,
    },
  });

  if (row.enabled) {
    void runPreparationReminders(companyId).catch((error) => {
      console.error("[preparation-reminders] run after save failed:", error);
    });
  }

  return toView(row);
}

let batchRunning = false;
let rerunRequested = false;

export async function runPreparationReminders(companyId?: string): Promise<void> {
  if (batchRunning) {
    rerunRequested = true;
    return;
  }

  batchRunning = true;
  try {
    let scope = companyId;
    do {
      rerunRequested = false;
      await dispatchDuePreparationReminders(scope);
      scope = undefined;
    } while (rerunRequested);
  } finally {
    batchRunning = false;
  }
}

async function dispatchDuePreparationReminders(companyId?: string): Promise<void> {
  const rows = await prisma.companyPreparationReminderSettings.findMany({
    where: {
      enabled: true,
      ...(companyId ? { companyId } : {}),
    },
    select: { companyId: true, intervalHours: true },
  });

  for (const row of rows) {
    const threshold = new Date(Date.now() - row.intervalHours * 60 * 60 * 1000);
    const deals = await prisma.deal.findMany({
      where: {
        companyId: row.companyId,
        currentStage: { in: [...STAGE_REMINDER_STAGES] },
        OR: [
          { preparationReminderSentAt: null },
          { preparationReminderSentAt: { lte: threshold } },
        ],
      },
      select: { id: true },
      orderBy: { stageEnteredAt: "asc" },
      take: 100,
    });

    for (const deal of deals) {
      try {
        await deliverPreparationReminder(deal.id);
      } catch (error) {
        console.error("[preparation-reminders] deal failed:", deal.id, error);
      }
    }
  }
}

export async function deliverPreparationReminder(
  dealId: string,
): Promise<"sent" | "skipped" | "failed"> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      companyId: true,
      clientName: true,
      vin: true,
      carBrand: true,
      carModel: true,
      currentStage: true,
      stageEnteredAt: true,
      preparationReminderSentAt: true,
      managerId: true,
      managerAssignments: { select: { managerId: true } },
    },
  });

  if (!deal || !isStageReminderStage(deal.currentStage)) {
    return "skipped";
  }

  const settings = await prisma.companyPreparationReminderSettings.findUnique({
    where: { companyId: deal.companyId },
  });
  if (!settings?.enabled) {
    return "skipped";
  }

  const now = new Date();
  if (!isPreparationReminderDue(deal.preparationReminderSentAt, settings.intervalHours, now)) {
    return "skipped";
  }

  const claimed = await prisma.deal.updateMany({
    where: {
      id: deal.id,
      currentStage: deal.currentStage,
      preparationReminderSentAt: deal.preparationReminderSentAt,
    },
    data: { preparationReminderSentAt: now },
  });
  if (claimed.count !== 1) {
    return "skipped";
  }

  try {
    const delivered = await sendPreparationReminder(deal, settings);
    if (delivered) return "sent";

    await prisma.deal.updateMany({
      where: { id: deal.id, preparationReminderSentAt: now },
      data: { preparationReminderSentAt: deal.preparationReminderSentAt },
    });
    return "failed";
  } catch (error) {
    await prisma.deal
      .updateMany({
        where: { id: deal.id, preparationReminderSentAt: now },
        data: { preparationReminderSentAt: deal.preparationReminderSentAt },
      })
      .catch((revertError) => {
        console.error("[preparation-reminders] revert failed:", deal.id, revertError);
      });
    throw error;
  }
}

async function sendPreparationReminder(
  deal: {
    id: string;
    companyId: string;
    clientName: string;
    vin: string;
    carBrand: string | null;
    carModel: string | null;
    currentStage: DealStageType;
    stageEnteredAt: Date;
    managerId: string | null;
    managerAssignments: Array<{ managerId: string }>;
  },
  settings: {
    messageTemplate: string;
    recipientMode: PreparationReminderRecipientMode;
    specificManagerId: string | null;
  },
): Promise<boolean> {
  const recipientIds = await resolveRecipientIds(deal, settings);
  if (recipientIds.length === 0) {
    console.warn(
      "[preparation-reminders] no recipients",
      deal.id,
      settings.recipientMode,
    );
    return true;
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: recipientIds },
      companyId: deal.companyId,
      role: { name: { in: [ROLES.MANAGER, ROLES.ADMIN] } },
    },
    select: { id: true, telegramChatId: true },
  });

  if (users.length === 0) {
    console.warn("[preparation-reminders] recipients missing in company", deal.id);
    return true;
  }

  const labels = await getCompanyStageLabels(deal.companyId);
  const { plain, html } = renderPreparationReminder(
    settings.messageTemplate,
    preparationReminderVars({
      ...deal,
      stageLabel: labels[deal.currentStage] ?? deal.currentStage,
    }),
  );

  let inApp = 0;
  for (const user of users) {
    try {
      await createNotification({
        userId: user.id,
        dealId: deal.id,
        title: "Напишите клиенту статус авто",
        message: plain,
        type: NotificationType.TELEGRAM,
      });
      inApp += 1;
    } catch (error) {
      console.error("[preparation-reminders] in-app notification failed:", user.id, error);
    }
  }

  const chatIds = users
    .map((user) => user.telegramChatId?.trim() || "")
    .filter((chatId) => chatId.length > 0);

  let telegramOk = 0;
  if (chatIds.length > 0) {
    const config = await getCompanyTelegramConfig(deal.companyId);
    if (!isCompanyTelegramConfigured(config) || !config.token) {
      console.warn(
        "[preparation-reminders] Telegram skipped: company bot token is not set",
        deal.companyId,
      );
    } else {
      const results = await sendCompanyTelegramMessages({
        token: config.token,
        chatIds,
        text: html,
      });
      telegramOk = results.filter((result) => result.ok).length;
      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        console.error(
          "[preparation-reminders] Telegram delivery failed:",
          failed.map((result) => `${result.chatId}: ${result.error}`).join("; "),
        );
      }
    }
  } else {
    console.warn(
      "[preparation-reminders] Telegram skipped: managers have no chat ID",
      users.map((user) => user.id),
    );
  }

  return inApp > 0 || telegramOk > 0;
}

async function resolveRecipientIds(
  deal: {
    companyId: string;
    managerId: string | null;
    managerAssignments: Array<{ managerId: string }>;
  },
  settings: {
    recipientMode: PreparationReminderRecipientMode;
    specificManagerId: string | null;
  },
): Promise<string[]> {
  if (settings.recipientMode === PreparationReminderRecipientMode.SPECIFIC) {
    if (!settings.specificManagerId) return [];
    const manager = await prisma.user.findFirst({
      where: {
        id: settings.specificManagerId,
        companyId: deal.companyId,
        role: { name: ROLES.MANAGER },
      },
      select: { id: true },
    });
    return manager ? [manager.id] : [];
  }

  return getDealManagerIds(deal);
}
