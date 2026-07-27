import { z } from "zod";

export const quickSearchSchema = z.object({
  query: z.string().trim().min(3, "Слишком короткий запрос").max(300),
});
