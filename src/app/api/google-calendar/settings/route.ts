import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { assertCompanyGoogleCalendarAccess } from "@/lib/services/company-workspace";
import {
  disconnectGoogleCalendar,
  getCompanyGoogleCalendarSettings,
} from "@/lib/services/google-calendar-settings";

export const GET = withAuth(async (_request, { user }) => {
  await assertCompanyGoogleCalendarAccess(user);
  return ok(await getCompanyGoogleCalendarSettings(user.companyId));
});

export const DELETE = withAuth(async (_request, { user }) => {
  await assertCompanyGoogleCalendarAccess(user);
  await disconnectGoogleCalendar(user.companyId);
  return ok(await getCompanyGoogleCalendarSettings(user.companyId));
});
