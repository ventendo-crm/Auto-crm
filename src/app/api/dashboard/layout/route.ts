import { withAuth, assertAllowed } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { canAccessDashboard, canManageCompanyDashboard } from "@/lib/permissions";
import {
  getCompanyDashboardLayout,
  saveCompanyDashboardLayout,
} from "@/lib/services/company-dashboard-settings";
import { saveDashboardLayoutSchema } from "@/lib/validators/dashboard-layout";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canAccessDashboard(user.role));
  return ok(await getCompanyDashboardLayout(user.companyId));
});

export const PUT = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyDashboard(user.role));
  const body = saveDashboardLayoutSchema.parse(await request.json());
  return ok(await saveCompanyDashboardLayout(user.companyId, body.layout));
});
