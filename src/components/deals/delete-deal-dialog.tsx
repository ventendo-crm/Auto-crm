"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

interface DeleteDealDialogProps {
  dealId: string;
  clientName: string;
  canDelete?: boolean;
  redirectTo?: string;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
  size?: "default" | "sm" | "icon";
}

export function DeleteDealDialog({
  dealId,
  clientName,
  canDelete = true,
  redirectTo,
  onDeleted,
  trigger,
  size = "sm",
}: DeleteDealDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!canDelete) {
    return null;
  }

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.deals.delete(dealId);
      toast.success(`Сделка «${clientName}» удалена`);
      setOpen(false);
      onDeleted?.();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить сделку");
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger =
    size === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        title="Удалить"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    ) : (
      <Button variant="outline" size={size} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" />
        Удалить
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? defaultTrigger}
      </DialogTrigger>

      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Удалить сделку?</DialogTitle>
          <DialogDescription>
            Сделка <b>{clientName}</b> будет удалена безвозвратно вместе со всеми документами,
            комментариями и историей этапов.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
