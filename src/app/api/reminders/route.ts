import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { ROLES } from "@/lib/permissions";
import { listTodayReminders } from "@/lib/services/reminders";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  if (user.role === ROLES.CLIENT || user.role === ROLES.VIEWER) {
    assertAllowed(false);
  }

  try {
    const reminders = await listTodayReminders(user);
    return ok(serialize(reminders));
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return error("Недостаточно прав", 403);
    }
    throw err;
  }
});
