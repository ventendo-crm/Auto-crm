import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { assertCompanyCalculatorAccess } from "@/lib/services/company-workspace";
import {
  getCalculatorSettings,
  upsertCalculatorPresets,
} from "@/lib/services/calculator-settings";
import { updateCalculatorSettingsSchema } from "@/lib/validators/calculator-settings";

export const GET = withAuth(async (_request, { user }) => {
  await assertCompanyCalculatorAccess(user);
  return ok(await getCalculatorSettings(user.id));
});

export const PUT = withAuth(async (request, { user }) => {
  await assertCompanyCalculatorAccess(user);
  const body = updateCalculatorSettingsSchema.parse(await request.json());
  return ok(await upsertCalculatorPresets(user.id, body.presets));
});
