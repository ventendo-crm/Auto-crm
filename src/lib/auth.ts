import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthUser, isRoleName, RoleName } from "@/lib/permissions";

const COOKIE_NAME = "auth-token";
const TOKEN_TTL = "7d";

export const AUTH_COOKIE_NAME = COOKIE_NAME;

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: RoleName;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  user: AuthUser
): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      getJwtSecret()
    );

    const role = payload.role;

    if (
      typeof payload.sub !== "string" ||
      typeof role !== "string" ||
      !isRoleName(role)
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: Request
): Promise<SessionPayload | null> {
  const authHeader =
    request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return verifySessionToken(
      authHeader.slice(7)
    );
  }

  const cookieHeader =
    request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const token = cookieHeader
    .split(";")
    .find((c) =>
      c.trim().startsWith(`${COOKIE_NAME}=`)
    )
    ?.split("=")[1];

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireAuth(
  request: Request
): Promise<AuthUser> {
  const session =
    await getSessionFromRequest(request);

  if (!session) {
    throw new AuthError(
      "Unauthorized",
      401
    );
  }

  return {
    id: session.sub,
    email: session.email,
    name: session.name,
    role: session.role,
  };
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user =
    await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      include: {
        role: true,
      },
    });

  if (!user) {
    return null;
  }

  const valid =
    await verifyPassword(
      password,
      user.passwordHash
    );

  if (!valid) {
    return null;
  }

  if (!isRoleName(user.role.name)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function setAuthCookie(response: Response, token: string): void {
  if (!(response instanceof Response)) return;

  const nextResponse = response as import("next/server").NextResponse;
  nextResponse.cookies.set(COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
}

export function clearAuthCookie(response: Response): void {
  if (!(response instanceof Response)) return;

  const nextResponse = response as import("next/server").NextResponse;
  nextResponse.cookies.set(COOKIE_NAME, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
