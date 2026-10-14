import { NextResponse } from "next/server";
import { AuthError, createSessionToken, getAuthCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRoleName } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password, companySlug } = await req.json();
    const normalizedEmail = String(email ?? "")
      .toLowerCase()
      .trim();

    const users = await prisma.user.findMany({
      where: {
        email: normalizedEmail,
        ...(companySlug ? { company: { slug: String(companySlug).trim() } } : {}),
      },
      include: {
        role: true,
        company: { select: { id: true, name: true, slug: true } },
      },
    });

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Пользователь не найден",
        },
        { status: 404 },
      );
    }

    if (users.length > 1 && !companySlug) {
      return NextResponse.json(
        {
          success: false,
          error: "Укажите компанию — найдено несколько аккаунтов с этим email",
          data: {
            companies: users.map((u) => ({
              slug: u.company.slug,
              name: u.company.name,
            })),
          },
        },
        { status: 409 },
      );
    }

    const user = users[0];

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Неверный пароль",
        },
        { status: 401 },
      );
    }

    if (!isRoleName(user.role.name)) {
      return NextResponse.json(
        {
          success: false,
          error: "Некорректная роль пользователя",
        },
        { status: 500 },
      );
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      companyId: user.companyId,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    const responseUser = serialize({
      id: user.id,
      name: user.name,
      email: user.email,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
      companyId: user.companyId,
      isPlatformAdmin: user.isPlatformAdmin,
      company: user.company,
      role: { id: user.role.id, name: user.role.name },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: responseUser,
      },
    });

    response.cookies.set("auth-token", token, getAuthCookieOptions());

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Ошибка сервера",
      },
      { status: 500 },
    );
  }
}
