import { withAuth } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import {
  deleteCarCarrierTrackingPoint,
  updateCarCarrierTrackingPoint,
} from "@/lib/services/car-carrier-tracking";
import { serialize } from "@/lib/serialize";
import { updateCarCarrierTrackingPointSchema } from "@/lib/validators/car-carrier-tracking";

export const PATCH = withAuth(async (request, { user, params }) => {
  const body = updateCarCarrierTrackingPointSchema.parse(await request.json());
  const point = await updateCarCarrierTrackingPoint(
    user,
    params.id,
    params.pointId,
    body,
  );
  return ok(serialize(point));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  await deleteCarCarrierTrackingPoint(user, params.id, params.pointId);
  return noContent();
});
