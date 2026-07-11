"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  const isChunkError =
    error.message.includes("ChunkLoadError") ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Failed to fetch dynamically imported module");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-lg font-semibold">Не удалось загрузить страницу</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {isChunkError
          ? "Похоже, обновилась версия сайта или пропала сеть. Обновите страницу."
          : "Произошла ошибка в приложении. Попробуйте обновить страницу."}
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Повторить
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Обновить
        </Button>
      </div>
    </div>
  );
}
