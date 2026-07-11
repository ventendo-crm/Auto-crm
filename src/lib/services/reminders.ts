import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser, ROLES, canUpdateDeal, canViewDeal } from "@/lib/permissions";
import { dealAccessSelect } from "@/lib/deal-managers";
import { createAuditLog } from "@/lib/services/audit";
import { buildManagerDealsWhere, getManagerPeerIdsForUser } from "@/lib/services/deal-access";
import { createReminderSchema, updateReminderSchema } from "@/lib/validators/reminders";
import { z } from "zod";

type CreateInput = z.infer<typeof createReminderSchema>;
type UpdateInput = z.infer<typeof updateReminderSchema>;

const reminderInclude = {
  deal: {
    select: {
      id: true,
      clientName: true,
      vin: true,
      managerId: true,
    },
  },
} as const;

async function dealAccessWhere(user: AuthUser): Promise<Prisma.DealWhereInput> {
  if (user.role === ROLES.MANAGER) {
    return buildManagerDealsWhere(user);
  }
  if (user.role === ROLES.ADMIN) {
    return {};
  }
  throw new Error("FORBIDDEN");
}

async function assertDealViewAccess(
  user: AuthUser,
  deal: { managerId: string | null; managerAssignments?: Array<{ managerId: string }> },
) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.MANAGER) {
    const peerIds = await getManagerPeerIdsForUser(user);
    if (canViewDeal(user.role, user.id, deal, peerIds)) return;
  }
  throw new Error("FORBIDDEN");
}

function assertDealManageAccess(
  user: AuthUser,
  deal: { managerId: string | null; managerAssignments?: Array<{ managerId: string }> },
) {
  if (!canUpdateDeal(user.role, user.id, deal)) {
    throw new Error("FORBIDDEN");
  }
}

function parseDueDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Некорректная дата");
  }
  return date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export async function listDealReminders(user: AuthUser, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: dealAccessSelect,
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  await assertDealViewAccess(user, deal);

  return prisma.reminder.findMany({
    where: { dealId },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    include: reminderInclude,
  });
}

export async function listTodayReminders(user: AuthUser) {
  if (user.role === ROLES.CLIENT || user.role === ROLES.VIEWER) {
    throw new Error("FORBIDDEN");
  }

  const now = new Date();
  const endToday = endOfDay(now);

  return prisma.reminder.findMany({
    where: {
      completed: false,
      dueDate: { lte: endToday },
      deal: await dealAccessWhere(user),
    },
    orderBy: { dueDate: "asc" },
    include: reminderInclude,
  });
}

export async function createReminder(
  user: AuthUser,
  dealId: string,
  input: CreateInput,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: dealAccessSelect,
  });

  if (!deal) {
    throw new Error("NOT_FOUND");
  }

  assertDealManageAccess(user, deal);

  const reminder = await prisma.reminder.create({
    data: {
      dealId,
      title: input.title.trim(),
      dueDate: parseDueDate(input.dueDate),
    },
    include: reminderInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "Reminder",
    entityId: reminder.id,
    action: "CREATE",
    newValue: { dealId, title: reminder.title, dueDate: reminder.dueDate },
  });

  return reminder;
}

export async function updateReminder(
  user: AuthUser,
  reminderId: string,
  input: UpdateInput,
) {
  const existing = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { deal: { select: dealAccessSelect } },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  assertDealManageAccess(user, existing.deal);

  const reminder = await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseDueDate(input.dueDate) } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
    },
    include: reminderInclude,
  });

  await createAuditLog({
    userId: user.id,
    entity: "Reminder",
    entityId: reminder.id,
    action: "UPDATE",
    newValue: input,
  });

  return reminder;
}

export async function deleteReminder(user: AuthUser, reminderId: string) {
  const existing = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { deal: { select: dealAccessSelect } },
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  assertDealManageAccess(user, existing.deal);

  await prisma.reminder.delete({ where: { id: reminderId } });

  await createAuditLog({
    userId: user.id,
    entity: "Reminder",
    entityId: reminderId,
    action: "DELETE",
    oldValue: { title: existing.title, dealId: existing.dealId },
  });
}

export function isReminderOverdue(dueDate: Date, completed: boolean): boolean {
  if (completed) return false;
  return dueDate < startOfDay(new Date());
}
