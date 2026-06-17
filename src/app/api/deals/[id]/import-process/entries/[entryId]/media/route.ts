import { withAuth, assertFound } from "@/lib/api-handler";
import { created, error } from "@/lib/api-response";
import { getDeal } from "@/lib/services/deals";
import { uploadImportProcessMedia } from "@/lib/services/import-process";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withAuth(async (request, { user, params }) => {
  assertFound(await getDeal(params.id));

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File) {
      files.push(single);
    }
  }

  if (files.length === 0) {
    return Response.json({ success: false, error: "Файлы не выбраны" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  const entry = await prisma.importProcessEntry.findFirst({
    where: { id: params.entryId, dealId: params.id },
    include: { _count: { select: { media: true } } },
  });

  if (!entry) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (entry._count.media + files.length > MAX_PROCESS_ENTRY_MEDIA) {
    return Response.json(
      {
        success: false,
        error: `Можно загрузить ещё ${Math.max(0, MAX_PROCESS_ENTRY_MEDIA - entry._count.media)} файл(ов)`,
      },
      { status: 400 },
    );
  }

  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadImportProcessMedia(user, params.id, params.entryId, file));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка загрузки";
    return error(message, 400);
  }

  return created(serialize(uploaded.length === 1 ? uploaded[0] : uploaded));
});
