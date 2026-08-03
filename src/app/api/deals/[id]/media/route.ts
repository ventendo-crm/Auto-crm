import { withAuth, assertFound } from "@/lib/api-handler";
import { created, error, ok } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { listDealMedia, uploadDealMedia } from "@/lib/services/media";
import { notifyClientGalleryMediaUploaded } from "@/lib/services/notifications";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = withAuth(async (_request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));
  const media = await listDealMedia(user, params.id);
  return ok(serialize(media));
});

export const POST = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id, user.companyId));

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File) {
      files.push(single);
    }
  }

  if (files.length === 0) {
    return error("No files provided", 400);
  }

  const uploaded = [];
  for (const file of files) {
    uploaded.push(await uploadDealMedia(user, params.id, file));
  }

  void notifyClientGalleryMediaUploaded({
    dealId: params.id,
    media: uploaded.map((item) => ({
      fileKey: item.fileKey,
      fileName: item.fileName,
      type: item.type,
    })),
  }).catch((err) => {
    console.error("[media] client telegram gallery notify failed:", err);
  });

  return created(serialize(uploaded.length === 1 ? uploaded[0] : uploaded));
});
