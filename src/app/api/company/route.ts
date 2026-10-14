import { assertAllowed, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canManageCompanyWorkspace } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateCompanyName } from "@/lib/services/companies";
import { serialize } from "@/lib/serialize";
import { updateCompanyNameSchema } from "@/lib/validators/companies";

export const GET = withAuth(async (_request, { user }) => {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: user.companyId },
    select: { id: true, name: true, slug: true },
  });
  return ok(serialize(company));
});

export const PATCH = withAuth(async (request, { user }) => {
  assertAllowed(canManageCompanyWorkspace(user.role));
  const body = updateCompanyNameSchema.parse(await request.json());
  try {
    const company = await updateCompanyName({
      companyId: user.companyId,
      actorId: user.id,
      name: body.name,
    });
    return ok(serialize(company));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Не удалось сохранить название компании", 400);
  }
});
