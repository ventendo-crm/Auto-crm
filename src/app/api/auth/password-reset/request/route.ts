import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-handler";
import { ok, error } from "@/lib/api-response";
import {
  PasswordResetError,
  requestPasswordReset,
} from "@/lib/services/password-reset";
import { requestPasswordResetSchema } from "@/lib/validators/auth";

export const POST = withPublic(async (request) => {
  const body = requestPasswordResetSchema.parse(await request.json());

  try {
    const result = await requestPasswordReset({
      email: body.email,
      companySlug: body.companySlug,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof PasswordResetError) {
      if (err.code === "MULTIPLE_ACCOUNTS") {
        return NextResponse.json(
          {
            success: false,
            error: err.message,
            data: { companies: err.companies ?? [] },
          },
          { status: 409 },
        );
      }
      if (err.code === "SMTP_NOT_CONFIGURED") {
        return error(err.message, 503);
      }
      return error(err.message, 400);
    }
    throw err;
  }
});
