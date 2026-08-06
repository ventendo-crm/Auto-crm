import { z } from "zod";
import { assertAllowed, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyAppearance } from "@/lib/permissions";
import {
  getCompanyAppearance,
  saveCompanyAppearance,
} from "@/lib/services/company-appearance";

const putSchema = z.object({
  presetId: z.string().min(1),
  customBrandHsl: z.string().nullable().optional(),
});

export const GET = withAuth(async (_request, { user }) => {
  return ok(await getCompanyAppearance(user.companyId));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyAppearance(user.role));
  const body = putSchema.parse(await request.json());
  try {
    return ok(
      await saveCompanyAppearance(user.companyId, {
        presetId: body.presetId,
        customBrandHsl: body.customBrandHsl,
      }),
    );
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось сохранить оформление", 400);
  }
});
