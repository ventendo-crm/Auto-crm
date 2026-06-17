import { withAuth, assertFound } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import {
  createImportProcessEntry,
  listImportProcessEntries,
} from "@/lib/services/import-process";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const entries = await listImportProcessEntries(user, params.id);
  return ok(serialize(entries));
});

export const POST = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const entry = await createImportProcessEntry(user, params.id);
  return created(serialize(entry));
});
