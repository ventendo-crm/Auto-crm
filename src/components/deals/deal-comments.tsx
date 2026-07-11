"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { COMMENT_AUTHOR_ROLE_LABELS } from "@/lib/constants";
import {
  canCommentOnDeal,
  canModifyComment,
  getClientRoleName,
} from "@/lib/permissions";
import { CommentItem } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

interface DealCommentsProps {
  dealId: string;
  managerId: string | null;
  managerIds?: string[];
  clientUserId?: string | null;
  initialComments: CommentItem[];
  onUpdate: () => void;
  canWrite?: boolean;
  pollingEnabled?: boolean;
}

const POLL_INTERVAL_MS = 3000;
function authorRoleLabel(roleName?: string): string {
  if (!roleName) return "Менеджер";
  return COMMENT_AUTHOR_ROLE_LABELS[roleName] ?? roleName;
}

function authorRoleBadgeClass(roleName?: string): string {
  if (roleName === "CLIENT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
}

function sortComments(comments: CommentItem[]): CommentItem[] {
  return [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function commentsFingerprint(comments: CommentItem[]): string {
  return comments.map((comment) => `${comment.id}:${comment.text}:${comment.createdAt}`).join("|");
}
export function DealComments({
  dealId,
  managerId,
  managerIds,
  clientUserId,
  initialComments,
  onUpdate,
  canWrite: canWriteProp,
  pollingEnabled = true,
}: DealCommentsProps) {
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState(() => sortComments(initialComments));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    setComments(sortComments(initialComments));
  }, [initialComments]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.05 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const applyPolledComments = useCallback((fresh: CommentItem[]) => {
    setComments((prev) => {
      const sorted = sortComments(fresh);
      if (commentsFingerprint(prev) === commentsFingerprint(sorted)) {
        return prev;
      }
      return sorted;
    });
  }, []);

  const shouldPoll = pollingEnabled && isInView && pageVisible;

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const fresh = await api.comments.list(dealId);
        if (!cancelled) {
          applyPolledComments(fresh);
        }
      } catch {
        // фоновый опрос не должен мешать переписке
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dealId, shouldPoll, applyPolledComments]);
  const role = getClientRoleName(user);
  const canWrite =
    canWriteProp ??
    (role && user
      ? canCommentOnDeal(role, user.id, { managerId, managerIds, clientUserId })
      : false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const comment = await api.comments.create(dealId, text.trim());
      setComments((prev) => sortComments([...prev, comment]));
      setText("");
      onUpdate();
      toast.success("Сообщение отправлено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.comments.delete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      onUpdate();
      toast.success("Сообщение удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div ref={cardRef}>
      <Card className="border-0 shadow-card">      <CardHeader>
        <CardTitle className="text-base">Комментарии и пожелания</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {comments.map((comment) => {
            const initials = comment.author.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const authorRole = comment.author.role?.name;
            const canDelete =
              role && user ? canModifyComment(role, user.id, comment.authorId) : false;

            return (
              <div key={comment.id} className="flex gap-3 rounded-lg border p-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      authorRole === "CLIENT"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-brand-muted text-brand",
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{comment.author.name}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", authorRoleBadgeClass(authorRole))}
                      >
                        {authorRoleLabel(authorRole)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                    {comment.text}
                  </p>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">Сообщений пока нет</p>
          )}
        </div>

        {canWrite && (
          <form onSubmit={handleSubmit} className="space-y-2 border-t pt-4">
            <Textarea
              placeholder="Напишите комментарий или пожелание..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
            <Button type="submit" variant="brand" size="sm" disabled={loading || !text.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить
            </Button>
          </form>
        )}
      </CardContent>
      </Card>
    </div>
  );
}