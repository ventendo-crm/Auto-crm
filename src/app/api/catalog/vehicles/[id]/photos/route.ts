import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { uploadCatalogVehiclePhoto } from "@/lib/services/catalog-vehicle-photos";
import { serialize } from "@/lib/serialize";
import { UNSUPPORTED_MEDIA_FORMAT_MESSAGE } from "@/lib/validators/media";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return error("Добавьте фото или видео", 400);
    }
    const trimIdRaw = form.get("trimId");
    const trimId = typeof trimIdRaw === "string" && trimIdRaw.trim() ? trimIdRaw.trim() : null;
    let vehicle = null;
    for (const file of files) {
      vehicle = await uploadCatalogVehiclePhoto(user, params.id, file, trimId);
    }
    return ok(serialize(vehicle));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return error("Авто не найдено", 404);
      if (
        err.message.startsWith("Максимум") ||
        err.message.includes("большой") ||
        err.message === UNSUPPORTED_MEDIA_FORMAT_MESSAGE
      ) {
        return error(err.message, 422);
      }
    }
    throw err;
  }
});
