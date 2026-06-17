import { withAuth, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { submitSearchProcessClientFeedback } from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";
import { searchProcessFeedbackSchema } from "@/lib/validators/search-process";

export const PATCH = withAuth(async (request, { user, params }) => {
  const body = searchProcessFeedbackSchema.parse(await request.json());

  try {
    const entry = await submitSearchProcessClientFeedback(
      user,
      params.id,
      params.entryId,
      body.feedback,
    );
    return ok(serialize(entry));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return error("Вариант поиска не найден", 404);
      }
      if (err.message === "FORBIDDEN") {
        return error("Недостаточно прав", 403);
      }
    }
    throw err;
  }
});
