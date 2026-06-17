import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canChangeStage } from "@/lib/permissions";
import { changeDealStage, getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { changeStageSchema } from "@/lib/validators/deal";

export const PATCH = withAuth(async (request, { user, params }) => {
  const existing = assertFound(await getDeal(params.id));
  assertAllowed(canChangeStage(user.role, user.id, existing.managerId));

  const body = changeStageSchema.parse(await request.json());
  const result = await changeDealStage(user, params.id, body.toStage);

  return ok(serialize(result));
});
