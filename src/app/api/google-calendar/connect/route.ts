import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { startGoogleCalendarConnect } from "@/lib/services/google-calendar-settings";
import { assertCompanyGoogleCalendarAccess } from "@/lib/services/company-workspace";
import { connectGoogleCalendarSchema } from "@/lib/validators/google-calendar";

export const POST = withAuth(async (request, { user }) => {
  await assertCompanyGoogleCalendarAccess(user);

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
