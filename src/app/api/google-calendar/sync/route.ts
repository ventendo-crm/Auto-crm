import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyGoogleCalendar } from "@/lib/permissions";
import { getCompanyGoogleCalendarSettings } from "@/lib/services/google-calendar-settings";
import { backfillCompanyGoogleCalendar } from "@/lib/google-calendar/sync";
import { prisma } from "@/lib/prisma";

export const POST = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyGoogleCalendar(user.role));

  const connected = await prisma.companyGoogleCalendarSettings.findUnique({
    where: { companyId: user.companyId },
    select: { companyId: true },
  });
  if (!connected) {
    return error("Сначала подключите Google-аккаунт", 400);
  }

  try {
    await backfillCompanyGoogleCalendar(user.companyId);
  } catch (err) {
    return error(
      err instanceof Error ? err.message : "Не удалось синхронизировать календарь",
      400,
    );
  }

  return ok(await getCompanyGoogleCalendarSettings(user.companyId));
});
