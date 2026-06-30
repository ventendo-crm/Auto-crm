import { withAuth, assertFound } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { createReminder, listDealReminders } from "@/lib/services/reminders";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { createReminderSchema } from "@/lib/validators/reminders";

export const GET = withAuth(async (_request, { user, params }) => {
  try {
    assertFound(await getDeal(params.id));
    const reminders = await listDealReminders(user, params.id);
    return ok(serialize(reminders));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Сделка не найдена", 404);
      }
      if (err.message === "FORBIDDEN") {
        return error("Недостаточно прав", 403);
      }
    }
    throw err;
  }
});

export const POST = withAuth(async (request, { user, params }) => {
  const body = createReminderSchema.parse(await request.json());

  try {
    assertFound(await getDeal(params.id));
    const reminder = await createReminder(user, params.id, body);
    return created(serialize(reminder));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Сделка не найдена", 404);
      }
      if (err.message === "FORBIDDEN") {
        return error("Недостаточно прав", 403);
      }
      if (err.message === "Некорректная дата") {
        return error(err.message, 400);
      }
    }
    throw err;
  }
});
