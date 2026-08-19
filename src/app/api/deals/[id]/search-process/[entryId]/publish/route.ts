import { withAuth, assertFound } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { publishSearchProcessEntryToClient } from "@/lib/services/search-process";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));

  try {
    const entry = await publishSearchProcessEntryToClient(user, params.id, params.entryId);
    return ok(serialize(entry));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    if (message === "NOT_FOUND") return error("Not found", 404);
    if (message === "ALREADY_PUBLISHED") {
      return error("Вариант уже отправлен клиенту. Используйте «Обновить у клиента».", 409);
    }
    if (message === "MEDIA_REQUIRED") {
      return error("Добавьте хотя бы одно фото или видео перед отправкой клиенту.", 400);
    }
    return error(message, 400);
  }
});
