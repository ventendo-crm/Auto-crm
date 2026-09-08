import { withAuth } from "@/lib/api-handler";
import { error } from "@/lib/api-response";

export const POST = withAuth(async () => {
  return error("Импорт с Che168 временно отключён", 410);
});
