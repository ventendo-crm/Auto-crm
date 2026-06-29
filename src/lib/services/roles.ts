import { ROLES, RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DEFAULT_ROLES: RoleName[] = [
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.VIEWER,
  ROLES.CLIENT,
];

export async function ensureDefaultRoles(): Promise<void> {
  for (const name of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
}

export async function getRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } });
}

export async function getManagerRole() {
  return getRoleByName("MANAGER");
}
