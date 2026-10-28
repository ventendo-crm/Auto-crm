import "@/lib/preparation-reminders/bootstrap";
import { assertAllowed, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canManageCompanyTelegram } from "@/lib/permissions";
import {
  getPreparationReminderSettings,
  savePreparationReminderSettings,
} from "@/lib/services/preparation-reminders";
import { preparationReminderSettingsSchema } from "@/lib/validators/preparation-reminder";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));
  return ok(await getPreparationReminderSettings(user.companyId));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyTelegram(user.role));
  const body = preparationReminderSettingsSchema.parse(await request.json());
  return ok(await savePreparationReminderSettings(user.companyId, body));
});
