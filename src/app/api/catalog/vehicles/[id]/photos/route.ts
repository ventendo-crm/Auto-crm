import { withAuth, assertAllowed } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import { uploadCatalogVehiclePhoto } from "@/lib/services/catalog-vehicle-photos";
import { serialize } from "@/lib/serialize";

export const POST = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return error("Добавьте фото", 400);
    }
    let vehicle = null;
    for (const file of files) {
      vehicle = await uploadCatalogVehiclePhoto(user, params.id, file);
    }
    return ok(serialize(vehicle));
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return error("Авто не найдено", 404);
      if (err.message.startsWith("Максимум") || err.message.includes("большой")) {
        return error(err.message, 422);
      }
    }
    throw err;
  }
});
