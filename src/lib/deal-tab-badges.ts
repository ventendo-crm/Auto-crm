import { CommentItem, DocumentItem } from "@/lib/types";

export function countUploadedDealDocuments(documents: DocumentItem[]): number {
  return documents.filter(
    (document) => Boolean(document.fileUrl) && document.status !== "MISSING",
  ).length;
}

function commentsSeenKey(dealId: string, userId: string): string {
  return `deal-comments-seen:${dealId}:${userId}`;
}

export function getCommentsLastSeen(dealId: string, userId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(commentsSeenKey(dealId, userId));
}

export function markCommentsSeen(
  dealId: string,
  userId: string,
  comments: CommentItem[],
): string | null {
  if (typeof window === "undefined" || comments.length === 0) return null;

  const latest = comments.reduce(
    (max, comment) => Math.max(max, new Date(comment.createdAt).getTime()),
    0,
  );
  const seenAt = new Date(latest).toISOString();
  localStorage.setItem(commentsSeenKey(dealId, userId), seenAt);
  return seenAt;
}

export function countUnreadComments(
  comments: CommentItem[],
  currentUserId: string,
  lastSeenAt: string | null,
): number {
  const seenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  return comments.filter(
    (comment) =>
      comment.authorId !== currentUserId &&
      new Date(comment.createdAt).getTime() > seenTime,
  ).length;
}
