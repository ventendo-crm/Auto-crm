import "@/lib/preparation-reminders/bootstrap";
import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import {
  getDealStageReminder,
  saveDealStageReminder,
} from "@/lib/services/preparation-reminders";
import { dealStageReminderSchema } from "@/lib/validators/deal-stage-reminder";

export const GET = withAuth(async (_request, { user, params }) => {
  return ok(await getDealStageReminder(user, params.id));
});

export const PUT = withAuth(async (request, { user, params }) => {
  const body = dealStageReminderSchema.parse(await request.json());
  return ok(await saveDealStageReminder(user, params.id, body));
});
