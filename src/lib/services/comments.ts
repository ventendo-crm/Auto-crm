import { prisma } from "@/lib/prisma";
import { dealAccessSelect } from "@/lib/deal-managers";
import { createAuditLog } from "@/lib/services/audit";

const commentInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
    },
  },
} as const;

export async function listComments(dealId: string) {
  return prisma.comment.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
    include: commentInclude,
  });
}

export async function getComment(id: string) {
  return prisma.comment.findUnique({
    where: { id },
    include: {
      ...commentInclude,
      deal: { select: dealAccessSelect },
    },
  });
}

export async function createComment(params: { dealId: string; authorId: string; text: string }) {
  const deal = await prisma.deal.findUnique({ where: { id: params.dealId } });
  if (!deal) {
    throw new Error("Not found");
  }

  const comment = await prisma.comment.create({
    data: {
      dealId: params.dealId,
      authorId: params.authorId,
      text: params.text,
    },
    include: commentInclude,
  });

  await createAuditLog({
    userId: params.authorId,
    entity: "Comment",
    entityId: comment.id,
    action: "CREATE",
    newValue: { dealId: params.dealId, text: params.text },
  });

  return comment;
}

export async function updateComment(id: string, userId: string, text: string) {
  const existing = await getComment(id);
  if (!existing) {
    throw new Error("Not found");
  }

  const comment = await prisma.comment.update({
    where: { id },
    data: { text },
    include: commentInclude,
  });

  await createAuditLog({
    userId,
    entity: "Comment",
    entityId: id,
    action: "UPDATE",
    oldValue: { text: existing.text },
    newValue: { text },
  });

  return comment;
}

export async function deleteComment(id: string, userId: string) {
  const existing = await getComment(id);
  if (!existing) {
    throw new Error("Not found");
  }

  await prisma.comment.delete({ where: { id } });

  await createAuditLog({
    userId,
    entity: "Comment",
    entityId: id,
    action: "DELETE",
    oldValue: { text: existing.text, dealId: existing.dealId },
  });
}
