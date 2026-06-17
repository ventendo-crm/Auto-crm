import { withAuth, assertFound } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import {
  deleteSearchProcessEntry,
  updateSearchProcessEntry,
} from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";
import { updateSearchProcessEntrySchema } from "@/lib/validators/search-process";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const body = updateSearchProcessEntrySchema.parse(await request.json());
  const entry = await updateSearchProcessEntry(
    user,
    params.id,
    params.entryId,
    body.description,
  );
  return ok(serialize(entry));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  await deleteSearchProcessEntry(user, params.id, params.entryId);
  return noContent();
});
