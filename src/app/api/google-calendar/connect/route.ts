import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyGoogleCalendar } from "@/lib/permissions";
import { startGoogleCalendarConnect } from "@/lib/services/google-calendar-settings";
import { connectGoogleCalendarSchema } from "@/lib/validators/google-calendar";

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyGoogleCalendar(user.role));

  const body = connectGoogleCalendarSchema.parse(await request.json());

  try {
    const url = await startGoogleCalendarConnect({
      companyId: user.companyId,
      userId: user.id,
      googleEmail: body.googleEmail,
    });
    return ok({ url });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось начать подключение Google", 400);
  }
});
