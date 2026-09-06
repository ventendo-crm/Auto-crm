import { withAuth } from "@/lib/api-handler";
import { created, error } from "@/lib/api-response";
import { createCalculatorOffer } from "@/lib/services/calculator-offers";
import { assertCompanyCalculatorAccess } from "@/lib/services/company-workspace";

export const runtime = "nodejs";

export const POST = withAuth(async (request, { user }) => {
  await assertCompanyCalculatorAccess(user);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error("Не удалось прочитать файлы");
  }

  const offer = await createCalculatorOffer(user, formData);
  return created(offer);
});
