import { withAuth, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { getDealShipment, upsertDealShipment } from "@/lib/services/shipment";
import { serialize } from "@/lib/serialize";
import { updateShipmentSchema } from "@/lib/validators/shipment";

export const GET = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const shipment = await getDealShipment(user, params.id);
  return ok(serialize(shipment));
});

export const PUT = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id));
  const body = updateShipmentSchema.parse(await request.json());
  const shipment = await upsertDealShipment(user, params.id, body);
  return ok(serialize(shipment));
});
