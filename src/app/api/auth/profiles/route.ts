import { assertFound, withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { isRoleName } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user }) => {
  const current = assertFound(
    await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    }),
  );

  const profiles = await prisma.user.findMany({
    where: { email: current.email },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      companyId: true,
      isPlatformAdmin: true,
      company: { select: { id: true, name: true, slug: true } },
      role: { select: { id: true, name: true } },
    },
  });

  return ok(
    serialize(
      profiles
        .filter((profile) => isRoleName(profile.role.name))
        .map((profile) => ({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          companyId: profile.companyId,
          isPlatformAdmin: profile.isPlatformAdmin,
          company: profile.company,
          role: profile.role,
          isCurrent: profile.id === user.id,
        })),
    ),
  );
});
