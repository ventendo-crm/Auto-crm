import { withAuth, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { updateSearchProcessLinks } from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";
import { updateSearchProcessLinksSchema } from "@/lib/validators/search-process-links";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id));

  const body = updateSearchProcessLinksSchema.parse(await request.json());
  const links = await updateSearchProcessLinks(user, params.id, body);

  return ok(serialize(links));
});
