import { withAuth, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { notifyClientSearchProcessEntryUpdate } from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));

  try {
    const entry = await notifyClientSearchProcessEntryUpdate(user, params.id, params.entryId);
    return ok(serialize(entry));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notify failed";
    if (message === "NOT_FOUND") return error("Not found", 404);
    if (message === "NOT_PUBLISHED") {
      return error("Сначала отправьте вариант клиенту.", 409);
    }
    if (message === "MEDIA_REQUIRED") {
      return error("Добавьте хотя бы одно фото или видео.", 400);
    }
    return error(message, 400);
  }
});
