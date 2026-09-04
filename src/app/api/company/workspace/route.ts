import { assertAllowed, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyWorkspace } from "@/lib/permissions";
import {
  ensureCompanyWorkspaceSettings,
  saveCompanyWorkspaceSettings,
} from "@/lib/services/company-workspace";
import { companyWorkspacePutSchema } from "@/lib/validators/company-workspace";

export const GET = withAuth(async (_request, { user }) => {
  return ok(await ensureCompanyWorkspaceSettings(user.companyId));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyWorkspace(user.role));
  const body = companyWorkspacePutSchema.parse(await request.json());
  try {
    return ok(await saveCompanyWorkspaceSettings(user.companyId, body));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось сохранить настройки компании", 400);
  }
});
