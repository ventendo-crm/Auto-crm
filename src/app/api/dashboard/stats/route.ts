import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { getDashboardData } from "@/lib/services/dashboard";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

const dashboardQuerySchema = z.object({
  managerId: z.string().cuid().optional(),
});

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const query = dashboardQuerySchema.parse({
    managerId: searchParams.get("managerId") ?? undefined,
  });

  const data = await getDashboardData(user, query.managerId);
  return ok(serialize(data));
});
