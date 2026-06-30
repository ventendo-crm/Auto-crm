import { withAuth } from "@/lib/api-handler";
import { error, noContent, ok } from "@/lib/api-response";
import { deleteReminder, updateReminder } from "@/lib/services/reminders";
import { serialize } from "@/lib/serialize";
import { updateReminderSchema } from "@/lib/validators/reminders";

export const PATCH = withAuth(async (request, { user, params }) => {
  const body = updateReminderSchema.parse(await request.json());

  try {
    const reminder = await updateReminder(user, params.id, body);
    return ok(serialize(reminder));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Напоминание не найдено", 404);
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

export const DELETE = withAuth(async (_request, { user, params }) => {
  try {
    await deleteReminder(user, params.id);
    return noContent();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Напоминание не найдено", 404);
      }
      if (err.message === "FORBIDDEN") {
        return error("Недостаточно прав", 403);
      }
    }
    throw err;
  }
});
