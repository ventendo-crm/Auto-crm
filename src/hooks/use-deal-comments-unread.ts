"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import {
  countUnreadComments,
  getCommentsLastSeen,
  markCommentsSeen,
} from "@/lib/deal-tab-badges";
import { CommentItem } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

export function useDealCommentsUnread(
  dealId: string,
  userId: string | undefined,
  comments: CommentItem[],
  commentsTabActive: boolean,
): number {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [liveComments, setLiveComments] = useState(comments);

  useEffect(() => {
    setLiveComments(comments);
  }, [comments]);

  useEffect(() => {
    if (!userId) {
      setLastSeen(null);
      return;
    }

    setLastSeen(getCommentsLastSeen(dealId, userId));
  }, [dealId, userId]);

  useEffect(() => {
    if (!userId || commentsTabActive) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const fresh = await api.comments.list(dealId);
        if (!cancelled) {
          setLiveComments(fresh);
        }
      } catch {
        // фоновый опрос не должен ломать навигацию
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [commentsTabActive, dealId, userId]);

  useEffect(() => {
    if (!userId || !commentsTabActive) return;

    const seenAt = markCommentsSeen(dealId, userId, liveComments);
    if (seenAt) {
      setLastSeen(seenAt);
    }
  }, [commentsTabActive, dealId, liveComments, userId]);

  return useMemo(() => {
    if (!userId) return 0;
    return countUnreadComments(liveComments, userId, lastSeen);
  }, [liveComments, lastSeen, userId]);
}
