import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canUpdateDeal } from "@/lib/permissions";
import { getDeal } from "@/lib/services/deals";
import { setImportProcessEnabled } from "@/lib/services/import-process";
import { serialize } from "@/lib/serialize";
import { setImportProcessEnabledSchema } from "@/lib/validators/import-process";

export const PATCH = withAuth(async (request, { user, params }) => {
  const existing = assertFound(await getDeal(params.id));
  assertAllowed(canUpdateDeal(user.role, user.id, existing));

  const body = setImportProcessEnabledSchema.parse(await request.json());

  try {
    const result = await setImportProcessEnabled(user, params.id, body.enabled);
    return ok(serialize(result));
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      assertFound(null);
    }
    throw err;
  }
});
