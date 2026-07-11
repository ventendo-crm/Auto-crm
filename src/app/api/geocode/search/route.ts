import { withAuth } from "@/lib/api-handler";
import { error, ok } from "@/lib/api-response";
import { searchPlaces } from "@/lib/services/geocode";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return error("Введите название города (минимум 2 символа)", 400);
  }

  try {
    const results = await searchPlaces(parsed.data.q);
    return ok(serialize(results));
  } catch {
    return error("Не удалось выполнить поиск. Попробуйте позже.", 502);
  }
});
