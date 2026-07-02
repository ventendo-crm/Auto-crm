import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canManageUsers } from "@/lib/permissions";
import { listEmailTemplates } from "@/lib/email/template-store";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageUsers(user.role));

  const templates = await listEmailTemplates();
  return ok(serialize(templates));
});
