import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isRoleName, RoleName, ROLES } from "@/lib/permissions";

const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/logout", "/api/telegram/webhook"];
const PUBLIC_PAGE_PATHS = ["/login"];

const STAFF_PAGE_PREFIXES = ["/dashboard", "/kanban", "/deals"];
const CLIENT_PAGE_PREFIXES = ["/my-deal"];

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

async function getSession(request: NextRequest): Promise<{ authenticated: boolean; role: RoleName | null }> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get("auth-token")?.value;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    return { authenticated: false, role: null };
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = payload.role;
    return {
      authenticated: true,
      role: typeof role === "string" && isRoleName(role) ? role : null,
    };
  } catch {
    return { authenticated: false, role: null };
  }
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { authenticated, role } = await getSession(request);

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.next();
    }
    if (!authenticated) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_PAGE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!authenticated && !isPublicPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && pathname === "/login") {
    const target = role === ROLES.CLIENT ? "/my-deal" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (authenticated && role === ROLES.CLIENT && matchesPrefix(pathname, STAFF_PAGE_PREFIXES)) {
    return NextResponse.redirect(new URL("/my-deal", request.url));
  }

  if (authenticated && role && role !== ROLES.CLIENT && matchesPrefix(pathname, CLIENT_PAGE_PREFIXES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    const target = role === ROLES.CLIENT ? "/my-deal" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
