"use client";

import { ImagePlus, Loader2, Upload, Video } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn, formatFileSize } from "@/lib/utils";

interface MediaUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
}

interface PendingFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function MediaUploadZone({ onUpload, disabled }: MediaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0 || disabled) return;

      const items: PendingFile[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending",
      }));

      setPending(items);
      setUploading(true);

      try {
        setPending((prev) => prev.map((p) => ({ ...p, status: "uploading" })));
        await onUpload(files);
        setPending((prev) => prev.map((p) => ({ ...p, status: "done" })));
        setTimeout(() => setPending([]), 1500);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка загрузки";
        setPending((prev) =>
          prev.map((p) => ({ ...p, status: "error", error: message })),
        );
      } finally {
        setUploading(false);
      }
    },
    [disabled, onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [disabled, processFiles],
  );

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all",
          isDragging
            ? "border-brand bg-brand-muted/50 scale-[1.01]"
            : "border-border bg-muted/20 hover:border-brand/50 hover:bg-brand-muted/20",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <div className="mb-3 flex gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <ImagePlus className="h-5 w-5" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Video className="h-5 w-5" />
          </div>
        </div>
        <p className="text-sm font-medium">
          {uploading ? "Загрузка..." : "Перетащите фото или видео сюда"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG, WebP, GIF · MP4, WebM, MOV
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Фото до 10 MB · Видео до 100 MB
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-brand">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          или нажмите для выбора
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          {pending.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{item.file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {item.status === "done" && "✓"}
                {item.status === "error" && (
                  <span className="text-destructive">{item.error}</span>
                )}
                {item.status === "pending" && formatFileSize(item.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
