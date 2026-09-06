import { DocumentStatus } from "@prisma/client";
import { withAuth, assertAllowed, assertFound } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { isDocumentTypeKey } from "@/lib/company-workspace/helpers";
import { canUpdateDeal } from "@/lib/permissions";
import { deleteDealDocument, updateDocumentStatus } from "@/lib/services/documents";
import { getDeal } from "@/lib/services/deals";
import { serialize } from "@/lib/serialize";
import { z } from "zod";

const updateSchema = z.object({
  status: z.nativeEnum(DocumentStatus),
});

export const PATCH = withAuth(async (request, { user, params }) => {
  if (!isDocumentTypeKey(params.type)) {
    throw new Error("Not found");
  }

  const deal = assertFound(await getDeal(params.id, user.companyId));
  assertAllowed(canUpdateDeal(user.role, user.id, deal));

  const body = updateSchema.parse(await request.json());
  const type = params.type;

  if (body.status !== DocumentStatus.RECEIVED && body.status !== DocumentStatus.VERIFIED) {
    throw new Error("Недопустимый статус");
  }

  const document = await updateDocumentStatus(user, params.id, type, body.status);
  return ok(serialize(document));
});

export const DELETE = withAuth(async (_request, { user, params }) => {
  if (!isDocumentTypeKey(params.type)) {
    throw new Error("Not found");
  }

  const deal = assertFound(await getDeal(params.id, user.companyId));
  assertAllowed(canUpdateDeal(user.role, user.id, deal));

  const document = await deleteDealDocument(user, params.id, params.type);
  return ok(serialize(document));
});
