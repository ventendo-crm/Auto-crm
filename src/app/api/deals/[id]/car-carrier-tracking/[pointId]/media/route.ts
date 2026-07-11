import { withAuth } from "@/lib/api-handler";
import { created, error } from "@/lib/api-response";
import { uploadCarCarrierTrackingMedia } from "@/lib/services/car-carrier-tracking";
import { MAX_TRACKING_POINT_MEDIA } from "@/lib/constants";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withAuth(async (request, { user, params }) => {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File) {
      files.push(single);
    }
  }

  if (files.length === 0) {
    return error("Файлы не выбраны", 400);
  }

  const { prisma } = await import("@/lib/prisma");
  const point = await prisma.carCarrierTrackingPoint.findFirst({
    where: { id: params.pointId, dealId: params.id },
    include: { _count: { select: { media: true } } },
  });

  if (!point) {
    return error("Not found", 404);
  }

  if (point._count.media + files.length > MAX_TRACKING_POINT_MEDIA) {
    return error(
      `Можно загрузить ещё ${Math.max(0, MAX_TRACKING_POINT_MEDIA - point._count.media)} файл(ов)`,
      400,
    );
  }

  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(
        await uploadCarCarrierTrackingMedia(user, params.id, params.pointId, file),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка загрузки";
    return error(message, 400);
  }

  return created(serialize(uploaded.length === 1 ? uploaded[0] : uploaded));
});
