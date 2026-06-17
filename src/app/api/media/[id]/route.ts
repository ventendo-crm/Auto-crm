import { withAuth } from "@/lib/api-handler";
import { noContent, ok } from "@/lib/api-response";
import { deleteMedia, getMediaById } from "@/lib/services/media";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export const GET = withAuth(async (_request, { user, params }) => {
  const media = await getMediaById(user, params.id);
  return ok(serialize(media));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  await deleteMedia(user, params.id);
  return noContent();
});
