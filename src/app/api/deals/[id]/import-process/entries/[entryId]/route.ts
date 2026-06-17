import { withAuth, assertFound } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import {
  deleteImportProcessEntry,
  updateImportProcessEntry,
} from "@/lib/services/import-process";
import { serialize } from "@/lib/serialize";
import { updateImportProcessEntrySchema } from "@/lib/validators/import-process";

export const PATCH = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const body = updateImportProcessEntrySchema.parse(await request.json());
  const entry = await updateImportProcessEntry(
    user,
    params.id,
    params.entryId,
    body.description,
  );
  return ok(serialize(entry));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  await deleteImportProcessEntry(user, params.id, params.entryId);
  return noContent();
});
