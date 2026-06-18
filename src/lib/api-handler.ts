import { AuthError, requireAuth } from "@/lib/auth";
import { AuthUser } from "@/lib/permissions";
import { error, unauthorized } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type RouteHandler = (
  request: Request,
  context: { user: AuthUser; params: Record<string, string> },
) => Promise<NextResponse>;

type PublicRouteHandler = (
  request: Request,
  context: { params: Record<string, string> },
) => Promise<NextResponse>;

export function withAuth(handler: RouteHandler) {
  return async (request: Request, routeContext: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await requireAuth(request);
      const params = await routeContext.params;
      return await handler(request, { user, params });
    } catch (err) {
      return handleError(err);
    }
  };
}

export function withPublic(handler: PublicRouteHandler) {
  return async (request: Request, routeContext: { params: Promise<Record<string, string>> }) => {
    try {
      const params = await routeContext.params;
      return await handler(request, { params });
    } catch (err) {
      return handleError(err);
    }
  };
}

function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return unauthorized(err.message);
  }

  if (err instanceof ZodError) {
    return error("Validation failed", 422, err.flatten());
  }

  if (err instanceof Error) {
    if (err.message === "Forbidden") {
      return error("Forbidden", 403);
    }
    if (err.message === "Not found") {
      return error("Not found", 404);
    }
    console.error(err);
    return error(err.message, 400);
  }

  console.error(err);
  return error("Internal server error", 500);
}

export function assertFound<T>(value: T | null | undefined, message = "Not found"): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

export function assertAllowed(condition: boolean, message = "Forbidden"): void {
  if (!condition) {
    throw new Error(message);
  }
}
