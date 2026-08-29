import { withAuth, assertAllowed } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  archiveCatalogVehicle,
  getCatalogVehicle,
  updateCatalogVehicle,
} from "@/lib/services/catalog-vehicles";
import { updateCatalogVehicleSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const vehicle = await getCatalogVehicle(user, params.id);
  return ok(serialize(vehicle));
});

export const PATCH = withAuth(async (request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = updateCatalogVehicleSchema.parse(await request.json());
  const vehicle = await updateCatalogVehicle(user, params.id, body);
  return ok(serialize(vehicle));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  assertAllowed(canAccessCatalog(user.role));
  await archiveCatalogVehicle(user, params.id);
  return noContent();
});
