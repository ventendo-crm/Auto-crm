import { NextResponse } from "next/server";
import { createSessionToken, getAuthCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRoleName } from "@/lib/permissions";
import { serialize } from "@/lib/serialize";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Пользователь не найден",
        },
        { status: 404 },
      );
    }

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
    });

    const responseUser = serialize({
      id: user.id,
      name: user.name,
      email: user.email,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
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
