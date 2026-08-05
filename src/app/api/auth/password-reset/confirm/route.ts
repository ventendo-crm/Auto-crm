import { withPublic } from "@/lib/api-handler";
import { ok, error } from "@/lib/api-response";
import {
  PasswordResetError,
  confirmPasswordReset,
} from "@/lib/services/password-reset";
import { confirmPasswordResetSchema } from "@/lib/validators/auth";

export const POST = withPublic(async (request) => {
  const body = confirmPasswordResetSchema.parse(await request.json());

  try {
    const result = await confirmPasswordReset({
      token: body.token,
      password: body.password,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return error(err.message, 400);
    }
    throw err;
  }
});
