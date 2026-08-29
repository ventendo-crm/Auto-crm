import { withAuth, assertAllowed } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import { canAccessCatalog } from "@/lib/permissions";
import {
  createCatalogVehicle,
  listCatalogBrands,
  listCatalogVehicles,
} from "@/lib/services/catalog-vehicles";
import { createCatalogVehicleSchema, catalogVehicleFiltersSchema } from "@/lib/validators/catalog";
import { serialize } from "@/lib/serialize";

export const GET = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const data = await listCatalogVehicles(user, catalogVehicleFiltersSchema.parse(params));
  return ok(serialize(data));
});

export const POST = withAuth(async (request, { user }) => {
  assertAllowed(canAccessCatalog(user.role));
  const body = createCatalogVehicleSchema.parse(await request.json());
  const vehicle = await createCatalogVehicle(user, body);
  return created(serialize(vehicle));
});
