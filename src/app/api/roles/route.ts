import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async () => {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return ok(serialize(roles));
});
