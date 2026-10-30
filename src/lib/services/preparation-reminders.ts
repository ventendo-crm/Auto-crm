import { DealStageType, NotificationType } from "@prisma/client";
import { getDealManagerIds } from "@/lib/deal-managers";
import { ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  advanceStageReminderSchedule,
  computeStageReminderNextAt,
  computeTaskReminderNotifyAt,
  formatTaskDueDate,
  isStageReminderDue,
  isStageReminderStage,
  renderStageReminderMessage,
  renderTaskReminderMessage,
  STAGE_REMINDER_STAGES,
} from "@/lib/preparation-reminders/message";
import { getCompanyStageLabels } from "@/lib/services/company-workspace";
import { canUserViewDeal } from "@/lib/services/deal-access";
import { createNotification } from "@/lib/services/notifications";
import { getAppPublicUrl, getCompanyTelegramConfig, isCompanyTelegramConfigured, sendCompanyTelegramMessages } from "@/lib/telegram/bot";
import type { DealStageReminderInput } from "@/lib/validators/deal-stage-reminder";
import type { AuthUser } from "@/lib/permissions";
import { canUpdateDeal } from "@/lib/permissions";

export interface DealStageReminderView {
  enabled: boolean;
  intervalDays: number;
  sendTime: string;
  timeZone: string;
  nextAt: string | null;
  activeOnStage: boolean;
  managersMissingTelegram: Array<{ id: string; name: string }>;
  hasManager: boolean;
}

function toView(input: {
  enabled: boolean;
  intervalDays: number;
  sendTime: string;
  timeZone: string;
  nextAt: Date | null;
  stage: string;
  managers: Array<{ id: string; name: string; telegramChatId: string | null }>;
}): DealStageReminderView {
  return {
    enabled: input.enabled,
    intervalDays: input.intervalDays,
    sendTime: input.sendTime,
    timeZone: input.timeZone,
    nextAt: input.nextAt ? input.nextAt.toISOString() : null,
    activeOnStage: input.enabled && isStageReminderStage(input.stage) && input.nextAt != null,
    managersMissingTelegram: input.managers
      .filter((manager) => !manager.telegramChatId?.trim())
      .map(({ id, name }) => ({ id, name })),
    hasManager: input.managers.length > 0,
  };
}

async function loadAssignedManagers(deal: {
  companyId: string;
  managerId: string | null;
  managerAssignments: Array<{ managerId: string }>;
}) {
  const ids = getDealManagerIds(deal);
  if (ids.length === 0) return [];

  return prisma.user.findMany({
    where: {
      id: { in: ids },
      companyId: deal.companyId,
      role: { name: ROLES.MANAGER },
    },
    select: { id: true, name: true, telegramChatId: true },
  });
}

const stageReminderSelect = {
  id: true,
  companyId: true,
  currentStage: true,
  stageReminderEnabled: true,
  stageReminderIntervalDays: true,
  stageReminderSendTime: true,
  stageReminderTimeZone: true,
  stageReminderNextAt: true,
  managerId: true,
  clientUserId: true,
  managerAssignments: { select: { managerId: true } },
} as const;

async function findVisibleDeal(user: AuthUser, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId: user.companyId },
    select: stageReminderSelect,
  });
  if (!deal || !(await canUserViewDeal(user, deal))) {
    return null;
  }
  return deal;
}

export async function getDealStageReminder(
  user: AuthUser,
  dealId: string,
): Promise<DealStageReminderView> {
  const deal = await findVisibleDeal(user, dealId);
  if (!deal) {
    throw new Error("Not found");
  }

  const managers = await loadAssignedManagers(deal);
  return toView({
    enabled: deal.stageReminderEnabled,
    intervalDays: deal.stageReminderIntervalDays,
    sendTime: deal.stageReminderSendTime,
    timeZone: deal.stageReminderTimeZone,
    nextAt: deal.stageReminderNextAt,
    stage: deal.currentStage,
    managers,
  });
}

export async function saveDealStageReminder(
  user: AuthUser,
  dealId: string,
  input: DealStageReminderInput,
): Promise<DealStageReminderView> {
  const deal = await findVisibleDeal(user, dealId);
  if (!deal) {
    throw new Error("Not found");
  }
  if (!canUpdateDeal(user.role, user.id, deal)) {
    throw new Error("Forbidden");
  }

  const now = new Date();
  const nextAt = computeStageReminderNextAt({
    enabled: input.enabled,
    intervalDays: input.intervalDays,
    sendTime: input.sendTime,
    timeZone: input.timeZone,
    stage: deal.currentStage,
    now,
    previous: {
      enabled: deal.stageReminderEnabled,
      intervalDays: deal.stageReminderIntervalDays,
      sendTime: deal.stageReminderSendTime,
      timeZone: deal.stageReminderTimeZone,
      nextAt: deal.stageReminderNextAt,
    },
  });

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: {
      stageReminderEnabled: input.enabled,
      stageReminderIntervalDays: input.intervalDays,
      stageReminderSendTime: input.sendTime,
      stageReminderTimeZone: input.timeZone,
      stageReminderNextAt: nextAt,
    },
    select: {
      currentStage: true,
      stageReminderEnabled: true,
      stageReminderIntervalDays: true,
      stageReminderSendTime: true,
      stageReminderTimeZone: true,
      stageReminderNextAt: true,
      companyId: true,
      managerId: true,
      managerAssignments: { select: { managerId: true } },
    },
  });

  const managers = await loadAssignedManagers(updated);
  return toView({
    enabled: updated.stageReminderEnabled,
    intervalDays: updated.stageReminderIntervalDays,
    sendTime: updated.stageReminderSendTime,
    timeZone: updated.stageReminderTimeZone,
    nextAt: updated.stageReminderNextAt,
    stage: updated.currentStage,
    managers,
  });
}

let batchRunning = false;
let rerunRequested = false;

export async function runPreparationReminders(): Promise<void> {
  if (batchRunning) {
    rerunRequested = true;
    return;
  }

  batchRunning = true;
  try {
    do {
      rerunRequested = false;
      await dispatchDueStageReminders();
      await dispatchDueTaskReminders();
    } while (rerunRequested);
  } finally {
    batchRunning = false;
  }
}

async function dispatchDueStageReminders(): Promise<void> {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: {
      stageReminderEnabled: true,
      currentStage: { in: [...STAGE_REMINDER_STAGES] },
      stageReminderNextAt: { lte: now },
    },
    select: { id: true },
    orderBy: { stageReminderNextAt: "asc" },
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
      stageReminderEnabled: true,
      stageReminderIntervalDays: true,
      stageReminderSendTime: true,
      stageReminderTimeZone: true,
      stageReminderNextAt: true,
      managerId: true,
      managerAssignments: { select: { managerId: true } },
    },
  });

  const now = new Date();
  if (
    !deal ||
    !deal.stageReminderEnabled ||
    !isStageReminderStage(deal.currentStage) ||
    !isStageReminderDue(deal.stageReminderNextAt, now)
  ) {
    return "skipped";
  }

  const claimedNextAt = advanceStageReminderSchedule({
    scheduledAt: deal.stageReminderNextAt ?? now,
    now,
    intervalDays: deal.stageReminderIntervalDays,
    sendTime: deal.stageReminderSendTime,
    timeZone: deal.stageReminderTimeZone,
  });
  const claimed = await prisma.deal.updateMany({
    where: {
      id: deal.id,
      stageReminderEnabled: true,
      currentStage: deal.currentStage,
      stageReminderNextAt: deal.stageReminderNextAt,
    },
    data: { stageReminderNextAt: claimedNextAt },
  });
  if (claimed.count !== 1) {
    return "skipped";
  }

  try {
    const result = await sendStageReminder(deal);
    if (result === "failed") {
      await revertClaim(deal.id, claimedNextAt, deal.stageReminderNextAt);
      return "failed";
    }
    if (result === "nobody") {
      console.warn("[preparation-reminders] no assigned manager, reminder skipped", deal.id);
    }
    return result === "delivered" ? "sent" : "skipped";
  } catch (error) {
    await revertClaim(deal.id, claimedNextAt, deal.stageReminderNextAt);
    throw error;
  }
}

async function revertClaim(dealId: string, claimedNextAt: Date, previousNextAt: Date | null) {
  await prisma.deal
    .updateMany({
      where: { id: dealId, stageReminderNextAt: claimedNextAt },
      data: { stageReminderNextAt: previousNextAt },
    })
    .catch((revertError) => {
      console.error("[preparation-reminders] revert failed:", dealId, revertError);
    });
}

async function notifyAssignedManagers(input: {
  deal: {
    id: string;
    companyId: string;
    managerId: string | null;
    managerAssignments: Array<{ managerId: string }>;
  };
  title: string;
  plain: string;
  html: string;
  logLabel: string;
}): Promise<"delivered" | "nobody" | "failed"> {
  const managers = await loadAssignedManagers(input.deal);
  if (managers.length === 0) {
    return "nobody";
  }

  let inApp = 0;
  for (const manager of managers) {
    try {
      await createNotification({
        userId: manager.id,
        dealId: input.deal.id,
        title: input.title,
        message: input.plain,
        type: NotificationType.TELEGRAM,
      });
      inApp += 1;
    } catch (error) {
      console.error(`[${input.logLabel}] in-app notification failed:`, manager.id, error);
    }
  }

  const chatIds = managers
    .map((manager) => manager.telegramChatId?.trim() || "")
    .filter((chatId) => chatId.length > 0);

  let telegramOk = 0;
  if (chatIds.length > 0) {
    const config = await getCompanyTelegramConfig(input.deal.companyId);
    if (!isCompanyTelegramConfigured(config) || !config.token) {
      console.warn(
        `[${input.logLabel}] Telegram skipped: company bot token is not set`,
        input.deal.companyId,
      );
    } else {
      const results = await sendCompanyTelegramMessages({
        token: config.token,
        chatIds,
        text: input.html,
      });
      telegramOk = results.filter((result) => result.ok).length;
      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        console.error(
          `[${input.logLabel}] Telegram delivery failed:`,
          failed.map((result) => `${result.chatId}: ${result.error}`).join("; "),
        );
      }
    }
  } else {
    console.warn(
      `[${input.logLabel}] Telegram skipped: managers have no chat ID`,
      managers.map((manager) => manager.id),
    );
  }

  return inApp > 0 || telegramOk > 0 ? "delivered" : "failed";
}

async function sendStageReminder(deal: {
  id: string;
  companyId: string;
  clientName: string;
  vin: string;
  carBrand: string | null;
  carModel: string | null;
  currentStage: DealStageType;
  managerId: string | null;
  managerAssignments: Array<{ managerId: string }>;
}): Promise<"delivered" | "nobody" | "failed"> {
  const labels = await getCompanyStageLabels(deal.companyId);
  const dealUrl = `${getAppPublicUrl()}/deals/${deal.id}`;
  const { plain, html } = renderStageReminderMessage({
    clientName: deal.clientName,
    carBrand: deal.carBrand,
    carModel: deal.carModel,
    stageLabel: labels[deal.currentStage] ?? deal.currentStage,
    vin: deal.vin,
    dealUrl,
  });

  return notifyAssignedManagers({
    deal,
    title: "Напоминание по клиенту",
    plain,
    html,
    logLabel: "preparation-reminders",
  });
}

async function dispatchDueTaskReminders(): Promise<void> {
  const horizon = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const reminders = await prisma.reminder.findMany({
    where: {
      completed: false,
      notifiedAt: null,
      dueDate: { lte: horizon },
    },
    select: { id: true },
    orderBy: { dueDate: "asc" },
    take: 100,
  });

  for (const reminder of reminders) {
    try {
      await deliverTaskReminder(reminder.id);
    } catch (error) {
      console.error("[task-reminders] reminder failed:", reminder.id, error);
    }
  }
}

export function scheduleTaskReminderDelivery(reminderId: string): void {
  void deliverTaskReminder(reminderId).catch((error) => {
    console.error("[task-reminders] scheduled delivery failed:", reminderId, error);
  });
}

export async function deliverTaskReminder(
  reminderId: string,
): Promise<"sent" | "skipped" | "failed"> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: {
      id: true,
      title: true,
      dueDate: true,
      completed: true,
      notifiedAt: true,
      deal: {
        select: {
          id: true,
          companyId: true,
          clientName: true,
          vin: true,
          carBrand: true,
          carModel: true,
          stageReminderSendTime: true,
          stageReminderTimeZone: true,
          managerId: true,
          managerAssignments: { select: { managerId: true } },
        },
      },
    },
  });

  if (!reminder || reminder.completed || reminder.notifiedAt) {
    return "skipped";
  }

  const now = new Date();
  const notifyAt = computeTaskReminderNotifyAt(
    reminder.dueDate,
    reminder.deal.stageReminderSendTime,
    reminder.deal.stageReminderTimeZone,
  );
  if (notifyAt.getTime() > now.getTime()) {
    return "skipped";
  }

  const claimed = await prisma.reminder.updateMany({
    where: { id: reminder.id, completed: false, notifiedAt: null },
    data: { notifiedAt: now },
  });
  if (claimed.count !== 1) {
    return "skipped";
  }

  try {
    const dealUrl = `${getAppPublicUrl()}/deals/${reminder.deal.id}`;
    const { plain, html } = renderTaskReminderMessage({
      clientName: reminder.deal.clientName,
      title: reminder.title,
      dueDateLabel: formatTaskDueDate(reminder.dueDate),
      carBrand: reminder.deal.carBrand,
      carModel: reminder.deal.carModel,
      vin: reminder.deal.vin,
      dealUrl,
    });
    const result = await notifyAssignedManagers({
      deal: reminder.deal,
      title: "Задача по клиенту",
      plain,
      html,
      logLabel: "task-reminders",
    });
    if (result === "failed") {
      await revertTaskClaim(reminder.id, now);
      return "failed";
    }
    if (result === "nobody") {
      console.warn("[task-reminders] no assigned manager, reminder skipped", reminder.id);
    }
    return result === "delivered" ? "sent" : "skipped";
  } catch (error) {
    await revertTaskClaim(reminder.id, now);
    throw error;
  }
}

async function revertTaskClaim(reminderId: string, claimedAt: Date) {
  await prisma.reminder
    .updateMany({
      where: { id: reminderId, notifiedAt: claimedAt },
      data: { notifiedAt: null },
    })
    .catch((revertError) => {
      console.error("[task-reminders] revert failed:", reminderId, revertError);
    });
}
