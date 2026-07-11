import { withAuth } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import {
  clearCarCarrierDestination,
  setCarCarrierDestination,
  updateCarCarrierDestinationTitle,
} from "@/lib/services/car-carrier-tracking";
import { serialize } from "@/lib/serialize";
import { setCarCarrierDestinationSchema } from "@/lib/validators/car-carrier-tracking";
import { z } from "zod";

export const PUT = withAuth(async (request, { user, params }) => {
  const body = setCarCarrierDestinationSchema.parse(await request.json());
  const destination = await setCarCarrierDestination(user, params.id, body);
  return ok(serialize(destination));
});

export const PATCH = withAuth(async (request, { user, params }) => {
  const body = z.object({ title: z.string().max(200) }).parse(await request.json());
  const destination = await updateCarCarrierDestinationTitle(user, params.id, body.title);
  return ok(serialize(destination));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  await clearCarCarrierDestination(user, params.id);
  return noContent();
});
