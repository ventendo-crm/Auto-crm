import { createSessionToken, getAuthCookieOptions } from "@/lib/auth";
import { assertFound, withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { isRoleName } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";
import { z } from "zod";

const switchSchema = z.object({
  userId: z.string().min(1),
});

export const POST = withAuth(async (request, { user }) => {
  const body = switchSchema.parse(await request.json());

  if (body.userId === user.id) {
    const current = assertFound(
      await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          telegramChatId: true,
          createdAt: true,
          companyId: true,
          isPlatformAdmin: true,
          company: { select: { id: true, name: true, slug: true } },
          role: { select: { id: true, name: true } },
        },
      }),
    );
    return ok(serialize(current));
  }

  const current = assertFound(
    await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    }),
  );

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    include: {
      role: true,
      company: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!target || target.email.toLowerCase() !== current.email.toLowerCase()) {
    return error("Профиль не найден", 404);
  }

  if (!isRoleName(target.role.name)) {
    return error("Некорректная роль профиля", 500);
  }

  const token = await createSessionToken({
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role.name,
    companyId: target.companyId,
    isPlatformAdmin: target.isPlatformAdmin,
  });

  const responseUser = serialize({
    id: target.id,
    name: target.name,
    email: target.email,
    telegramChatId: target.telegramChatId,
    createdAt: target.createdAt,
    companyId: target.companyId,
    isPlatformAdmin: target.isPlatformAdmin,
    company: target.company,
    role: { id: target.role.id, name: target.role.name },
  });

  const response = NextResponse.json({
    success: true,
    data: responseUser,
  });

  response.cookies.set("auth-token", token, getAuthCookieOptions());

  return response;
});
