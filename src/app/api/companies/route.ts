import { assertAllowed, withAuth } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { canManageCompanies } from "@/lib/permissions";
import { createCompanyWithAdmin, listCompanies } from "@/lib/services/companies";
import { serialize } from "@/lib/serialize";
import { createCompanySchema } from "@/lib/validators/companies";

export const GET = withAuth(async (_request, { user }) => {
  assertAllowed(canManageCompanies(user));
  return ok(serialize(await listCompanies()));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanies(user));

  const body = createCompanySchema.parse(await request.json());

  try {
    const company = await createCompanyWithAdmin({
      ...body,
      actorId: user.id,
    });
    return created(serialize(company));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("ROLE_NOT_FOUND:")) {
      return error("Роль ADMIN не найдена", 500);
    }
    throw err;
  }
});
