import { withAuth } from "@/lib/api-handler";
import { created, ok } from "@/lib/api-response";
import {
  createCarCarrierTrackingPoint,
  getCarCarrierTracking,
} from "@/lib/services/car-carrier-tracking";
import { serialize } from "@/lib/serialize";
import { createCarCarrierTrackingPointSchema } from "@/lib/validators/car-carrier-tracking";

export const GET = withAuth(async (_request, { user, params }) => {
  const data = await getCarCarrierTracking(user, params.id);
  return ok(serialize(data));
});

export const POST = withAuth(async (request, { user, params }) => {
  const body = createCarCarrierTrackingPointSchema.parse(await request.json());
  const point = await createCarCarrierTrackingPoint(user, params.id, body);
  return created(serialize(point));
});
