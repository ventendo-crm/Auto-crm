"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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

interface DeleteUserDialogProps {
  userId: string;
  userName: string;
  dealsCount?: number;
  isSelf?: boolean;
  onDeleted?: () => void;
}

export function DeleteUserDialog({
  userId,
  userName,
  dealsCount = 0,
  isSelf = false,
  onDeleted,
}: DeleteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.users.delete(userId);
      toast.success(`Пользователь «${userName}» удалён`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить пользователя");
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Удалить
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить пользователя?</DialogTitle>
          <DialogDescription>
            Учётная запись <b>{userName}</b> будет удалена безвозвратно.
            {dealsCount > 0 ? (
              <>
                {" "}
                Сначала переназначьте {dealsCount} сделок другому менеджеру — иначе удаление
                невозможно.
              </>
            ) : (
              " Пользователь больше не сможет войти в систему."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || dealsCount > 0}>
            {loading && <Loader2 className="animate-spin" />}
            Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
