"use client";

import { Copy, ImagePlus, Loader2, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CustomsCalculator,
  type CalculatorCaptureApi,
} from "@/components/calculator/customs-calculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
  buildTelegramShareUrl,
  OFFER_MAX_TOTAL_BYTES,
  resolvePublicOfferAbsoluteUrl,
} from "@/lib/calculator/offer-share";
import { isPhoneFileShare, buildOfferShareText, shareOfferPackage } from "@/lib/calculator/share-export";
import { formatCurrency } from "@/lib/utils";

const MAX_PHOTOS = 15;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const DESCRIPTION_MAX = 4000;
const STORAGE_DESCRIPTION = "crm-offer-description";
const STORAGE_LINK = "crm-offer-link";

type OfferPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function CalculatorOfferWorkspace() {
  const captureApiRef = useRef<CalculatorCaptureApi | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photos, setPhotos] = useState<OfferPhoto[]>([]);
  const [sharing, setSharing] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDescription(sessionStorage.getItem(STORAGE_DESCRIPTION) ?? "");
      setSourceUrl(sessionStorage.getItem(STORAGE_LINK) ?? "");
    } catch {
      // sessionStorage может быть недоступен
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_DESCRIPTION, description);
      sessionStorage.setItem(STORAGE_LINK, sourceUrl);
    } catch {
      // ignore quota
    }
  }, [description, sourceUrl]);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const addPhotos = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(isImageFile);
    if (incoming.length === 0) {
      toast.error("Можно добавить только фото");
      return;
    }

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Не больше ${MAX_PHOTOS} фото`);
      return;
    }

    const accepted: OfferPhoto[] = [];
    for (const file of incoming.slice(0, room)) {
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`«${file.name}» больше 8 МБ`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (incoming.length > room) {
      toast.error(`Добавлены первые ${room} фото, лимит ${MAX_PHOTOS}`);
    }
    if (accepted.length > 0) {
      setPhotos((current) => [...current, ...accepted]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const next = current.filter((photo) => photo.id !== id);
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const collectSharePayload = async () => {
    const totalLabel =
      captureApiRef.current?.totalWithCar() != null
        ? formatCurrency(captureApiRef.current.totalWithCar())
        : null;
    const text = buildOfferShareText({ description, sourceUrl, totalLabel });
    const photoFiles = photos.map((photo) => photo.file);
    const estimate = captureApiRef.current?.canCapture()
      ? await captureApiRef.current.captureJpeg()
      : null;
    const files = estimate ? [...photoFiles, estimate] : photoFiles;
    return { text, files, photoFiles, estimate, totalLabel };
  };

  const publishOfferLink = async (
    text: string,
    photoFiles: File[],
    estimate: File | null,
    totalLabel: string | null,
  ) => {
    const files = estimate ? [...photoFiles, estimate] : photoFiles;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > OFFER_MAX_TOTAL_BYTES) {
      throw new Error("Слишком большой набор файлов — уберите часть фото");
    }

    const created = await api.calculatorOffers.create({
      description,
      sourceUrl,
      totalLabel,
      photos: photoFiles,
      estimate,
    });
    const url = resolvePublicOfferAbsoluteUrl(created.token);
    const clipboard = [text, url].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(clipboard);
    } catch {
      // ссылку всё равно покажем на экране
    }
    setCreatedLink(url);
    return url;
  };

  const handleShare = async () => {
    if (!description.trim() && !sourceUrl.trim() && photos.length === 0 && !captureApiRef.current?.canCapture()) {
      toast.error("Добавьте описание, ссылку, фото или расчёт");
      return;
    }

    const previewText = buildOfferShareText({
      description,
      sourceUrl,
      totalLabel:
        captureApiRef.current?.totalWithCar() != null
          ? formatCurrency(captureApiRef.current.totalWithCar())
          : null,
    });
    if (previewText) {
      try {
        await navigator.clipboard.writeText(previewText);
      } catch {
        // на части телефонов буфер недоступен до шаринга
      }
    }

    setSharing(true);
    try {
      const { text, files, photoFiles, estimate, totalLabel } = await collectSharePayload();

      if (isPhoneFileShare() && files.length > 0) {
        try {
          await shareOfferPackage({
            title: text || "Авто из ImportCRM",
            text,
            files,
          });
          if (text) {
            toast.success("Текст скопирован", {
              description: "Вставьте его в сообщение — Telegram и Max сами подпись не подставляют.",
              duration: 8000,
            });
          }
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
          if (
            !(shareError instanceof Error) ||
            (shareError.message !== "SHARE_TEXT_ONLY" &&
              shareError.message !== "SHARE_UNAVAILABLE" &&
              shareError.message !== "SHARE_FILES_UNSUPPORTED")
          ) {
            throw shareError;
          }
        }
      }

      await publishOfferLink(text, photoFiles, estimate, totalLabel);
      toast.success("Ссылка создана", {
        description: "Скопирована в буфер, действует 30 дней.",
        duration: 6000,
      });
      requestAnimationFrame(() => {
        document.getElementById("offer-created-link")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Подбор авто</CardTitle>
          <p className="text-sm text-muted-foreground">
            Фото, описание, ссылка и расчёт. На телефоне — сразу в мессенджер, на компьютере — ссылка для клиента.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offer-photos">Фото ({photos.length}/{MAX_PHOTOS})</Label>
            <input
              ref={photoInputRef}
              id="offer-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Удалить фото"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/40"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[11px]">Добавить</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-description">Описание</Label>
            <Textarea
              id="offer-description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="Марка, комплектация, состояние, что важно клиенту…"
              rows={6}
              maxLength={DESCRIPTION_MAX}
            />
            <p className="text-xs text-muted-foreground">{description.length}/{DESCRIPTION_MAX}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-link">Ссылка на объявление</Label>
            <Input
              id="offer-link"
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>
        </CardContent>
      </Card>

      <CustomsCalculator captureApiRef={captureApiRef} embedded />

      <div className="sticky bottom-3 z-30 space-y-3">
        {createdLink && (
          <div id="offer-created-link" className="space-y-2 rounded-xl border bg-card p-3 shadow-lg">
            <p className="text-sm font-medium">Ссылка создана · 30 дней</p>
            <p className="break-all text-xs text-muted-foreground">{createdLink}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(createdLink);
                  toast.success("Ссылка скопирована");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Копировать ссылку
              </Button>
              <Button type="button" size="sm" variant="brand" asChild>
                <a href={buildTelegramShareUrl(createdLink, "Подбор авто")} target="_blank" rel="noreferrer">
                  Открыть в Telegram
                </a>
              </Button>
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="brand"
          className="h-12 w-full shadow-lg"
          disabled={sharing}
          onClick={() => void handleShare()}
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Поделиться
        </Button>
      </div>
    </div>
  );
}
