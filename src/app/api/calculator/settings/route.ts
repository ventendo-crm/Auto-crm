import { assertAllowed, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessCalculator } from "@/lib/permissions";
import {
  getCalculatorSettings,
  upsertCalculatorPresets,
} from "@/lib/services/calculator-settings";
import { updateCalculatorSettingsSchema } from "@/lib/validators/calculator-settings";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));
  return ok(await getCalculatorSettings(user.id));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCalculator(user.role));
  const body = updateCalculatorSettingsSchema.parse(await request.json());
  return ok(await upsertCalculatorPresets(user.id, body.presets));
});
