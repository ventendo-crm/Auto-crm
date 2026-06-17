import { prisma } from "@/lib/prisma";

export async function getRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } });
}

export async function getManagerRole() {
  return getRoleByName("MANAGER");
}
