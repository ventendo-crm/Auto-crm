import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canManageCompanyGoogleCalendar } from "@/lib/permissions";
import {
  disconnectGoogleCalendar,
  getCompanyGoogleCalendarSettings,
} from "@/lib/services/google-calendar-settings";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyGoogleCalendar(user.role));
  return ok(await getCompanyGoogleCalendarSettings(user.companyId));
});

export const DELETE = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyGoogleCalendar(user.role));
  await disconnectGoogleCalendar(user.companyId);
  return ok(await getCompanyGoogleCalendarSettings(user.companyId));
});
