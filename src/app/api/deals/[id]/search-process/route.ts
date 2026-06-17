import { withAuth, assertFound } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import {
  createSearchProcessEntry,
  listSearchProcess,
} from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const data = await listSearchProcess(user, params.id);
  return ok(serialize(data));
});

export const POST = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const entry = await createSearchProcessEntry(user, params.id);
  return created(serialize(entry));
});
