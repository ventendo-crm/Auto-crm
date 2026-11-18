"use client";

import { Copy, ImagePlus, Link2, Loader2, Plus, Share2, X } from "lucide-react";
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
  buildSelectionLinkCaption,
  buildSelectionLinkClipboard,
  buildTelegramShareUrl,
  OFFER_DESCRIPTION_MAX,
  OFFER_MAX_ITEMS,
  OFFER_MAX_PHOTOS,
  OFFER_MAX_TOTAL_BYTES,
  OFFER_SELECTION_TITLE_MAX,
  OFFER_VEHICLE_TITLE_MAX,
  resolvePublicOfferAbsoluteUrl,
} from "@/lib/calculator/offer-share";
import { isPhoneFileShare, buildOfferShareText, shareOfferPackage } from "@/lib/calculator/share-export";
import type { CustomsCalculatorInput } from "@/lib/customs-calculator";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { cn, formatCurrency } from "@/lib/utils";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const STORAGE_DESCRIPTION = "crm-offer-description";
const STORAGE_TITLE = "crm-offer-vehicle-title";
const STORAGE_LINK = "crm-offer-link";
const STORAGE_SELECTION = "crm-offer-selection-title";

type OfferPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type OfferVariant = {
  id: string;
  vehicleTitle: string;
  description: string;
  sourceUrl: string;
  photos: OfferPhoto[];
  calcInput: CustomsCalculatorInput | null;
  calcEpoch: number;
  estimateFile: File | null;
  totalLabel: string | null;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function createVariantId() {
  return Math.random().toString(36).slice(2, 10);
}

function createVariant(overrides: Partial<OfferVariant> = {}): OfferVariant {
  return {
    id: createVariantId(),
    vehicleTitle: "",
    description: "",
    sourceUrl: "",
    photos: [],
    calcInput: null,
    calcEpoch: 0,
    estimateFile: null,
    totalLabel: null,
    ...overrides,
  };
}

function variantHasContent(variant: OfferVariant, isActive: boolean, captureApi: CalculatorCaptureApi | null) {
  return Boolean(
    variant.vehicleTitle.trim() ||
      variant.description.trim() ||
      variant.sourceUrl.trim() ||
      variant.photos.length > 0 ||
      variant.estimateFile ||
      (isActive && captureApi?.canCapture()),
  );
}

function variantChipLabel(variant: OfferVariant, index: number) {
  const title = variant.vehicleTitle.trim();
  if (!title) return `Вариант ${index + 1}`;
  return title.length > 18 ? `${title.slice(0, 17)}…` : title;
}

function copyOfferCalcCharacteristics(
  from: CustomsCalculatorInput,
  onto: CustomsCalculatorInput | null,
): CustomsCalculatorInput {
  return {
    ...(onto ?? from),
    originCountry: from.originCountry,
    importer: from.importer,
    age: from.age,
    engine: from.engine,
    vehicleCategory: from.vehicleCategory,
    gvwKg: from.gvwKg,
    powerHp: from.powerHp,
    volumeCc: from.volumeCc,
    currency: from.currency,
    rates: { ...from.rates },
    recyclingFeeYear: from.recyclingFeeYear,
    price: onto?.price ?? 0,
    customsPrice: onto?.customsPrice,
  };
}

export function CalculatorOfferWorkspace() {
  const { settings } = useCompanyWorkspace();
  const captionTemplate = settings.offerLinkCaptionTemplate;
  const captureApiRef = useRef<CalculatorCaptureApi | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [selectionTitle, setSelectionTitle] = useState("");
  const [variants, setVariants] = useState<OfferVariant[]>(() => [createVariant()]);
  const [activeId, setActiveId] = useState(() => variants[0]!.id);
  const [sharing, setSharing] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const busy = sharing || creatingLink || switching;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const variantsRef = useRef(variants);
  variantsRef.current = variants;

  const active = variants.find((variant) => variant.id === activeId) ?? variants[0]!;
  const activeIndex = Math.max(
    0,
    variants.findIndex((variant) => variant.id === active.id),
  );
  const previousVariant = activeIndex > 0 ? variants[activeIndex - 1]! : null;
  const filledCount = variants.filter((variant) =>
    variantHasContent(variant, variant.id === active.id, captureApiRef.current),
  ).length;

  useEffect(() => {
    try {
      const storedTitle = sessionStorage.getItem(STORAGE_TITLE) ?? "";
      const storedDescription = sessionStorage.getItem(STORAGE_DESCRIPTION) ?? "";
      const storedLink = sessionStorage.getItem(STORAGE_LINK) ?? "";
      setSelectionTitle(sessionStorage.getItem(STORAGE_SELECTION) ?? "");
      if (storedTitle || storedDescription || storedLink) {
        setVariants((current) =>
          current.map((variant, index) =>
            index === 0
              ? {
                  ...variant,
                  vehicleTitle: storedTitle,
                  description: storedDescription,
                  sourceUrl: storedLink,
                }
              : variant,
          ),
        );
      }
    } catch {
      // sessionStorage может быть недоступен
    }
  }, []);

  useEffect(() => {
    try {
      const first = variants[0];
      sessionStorage.setItem(STORAGE_SELECTION, selectionTitle);
      sessionStorage.setItem(STORAGE_TITLE, first?.vehicleTitle ?? "");
      sessionStorage.setItem(STORAGE_DESCRIPTION, first?.description ?? "");
      sessionStorage.setItem(STORAGE_LINK, first?.sourceUrl ?? "");
    } catch {
      // ignore quota
    }
  }, [selectionTitle, variants]);

  useEffect(() => {
    return () => {
      variantsRef.current.forEach((variant) => {
        variant.photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      });
    };
  }, []);

  const updateActive = (patch: Partial<OfferVariant>) => {
    const id = activeIdRef.current;
    setVariants((current) => current.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)));
  };

  const snapshotActive = async (list: OfferVariant[] = variantsRef.current): Promise<OfferVariant[]> => {
    const id = activeIdRef.current;
    const captureApi = captureApiRef.current;
    let estimateFile: File | null | undefined;
    if (captureApi?.canCapture()) {
      try {
        estimateFile = await captureApi.captureJpeg();
      } catch {
        estimateFile = undefined;
      }
    }
    const total = captureApi?.totalWithCar() ?? null;
    const calcInput = captureApi?.currentInput() ?? null;
    return list.map((variant) => {
      if (variant.id !== id) return variant;
      return {
        ...variant,
        calcInput: calcInput ?? variant.calcInput,
        estimateFile: estimateFile ?? variant.estimateFile,
        totalLabel: total != null ? formatCurrency(total) : variant.totalLabel,
      };
    });
  };

  const addPhotos = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(isImageFile);
    if (incoming.length === 0) {
      toast.error("Можно добавить только фото");
      return;
    }

    const room = OFFER_MAX_PHOTOS - active.photos.length;
    if (room <= 0) {
      toast.error(`Не больше ${OFFER_MAX_PHOTOS} фото`);
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
      toast.error(`Добавлены первые ${room} фото, лимит ${OFFER_MAX_PHOTOS}`);
    }
    if (accepted.length > 0) {
      updateActive({ photos: [...active.photos, ...accepted] });
    }
  };

  const removePhoto = (id: string) => {
    const next = active.photos.filter((photo) => photo.id !== id);
    const removed = active.photos.find((photo) => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    updateActive({ photos: next });
  };

  const handleCopyPreviousSpecs = () => {
    if (!previousVariant) return;
    const from = previousVariant.calcInput;
    if (!from) {
      toast.error("Сначала посчитайте предыдущий вариант");
      return;
    }
    const onto = captureApiRef.current?.currentInput() ?? active.calcInput;
    updateActive({
      calcInput: copyOfferCalcCharacteristics(from, onto),
      calcEpoch: active.calcEpoch + 1,
      estimateFile: null,
      totalLabel: null,
    });
    toast.success("Скопированы курс, объём и мощность");
  };

  const handleAddVariant = async () => {
    if (variants.length >= OFFER_MAX_ITEMS) {
      toast.error(`Не больше ${OFFER_MAX_ITEMS} авто в одной подборке`);
      return;
    }
    setSwitching(true);
    try {
      const nextList = await snapshotActive();
      const created = createVariant();
      setVariants([...nextList, created]);
      setActiveId(created.id);
      setCreatedLink(null);
    } finally {
      setSwitching(false);
    }
  };

  const handleSelectVariant = async (id: string) => {
    if (id === activeId) return;
    setSwitching(true);
    try {
      const nextList = await snapshotActive();
      setVariants(nextList);
      setActiveId(id);
    } finally {
      setSwitching(false);
    }
  };

  const handleRemoveVariant = async (id: string) => {
    if (variants.length <= 1) return;
    setSwitching(true);
    try {
      const snapped = id === activeId ? variants : await snapshotActive();
      const removedIndex = snapped.findIndex((variant) => variant.id === id);
      const removed = snapped[removedIndex];
      removed?.photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      const next = snapped.filter((variant) => variant.id !== id);
      setVariants(next);
      if (activeId === id) {
        setActiveId(next[Math.max(0, removedIndex - 1)]?.id ?? next[0]!.id);
      }
      setCreatedLink(null);
    } finally {
      setSwitching(false);
    }
  };

  const collectFilledItems = (list: OfferVariant[]) =>
    list.filter((variant) =>
      variantHasContent(variant, variant.id === activeIdRef.current, captureApiRef.current),
    );

  const publishOfferLink = async (list: OfferVariant[]) => {
    const items = collectFilledItems(list);
    if (items.length === 0) {
      throw new Error("Добавьте марку, описание, ссылку, фото или расчёт");
    }

    const files = items.flatMap((item) => [
      ...item.photos.map((photo) => photo.file),
      ...(item.estimateFile ? [item.estimateFile] : []),
    ]);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > OFFER_MAX_TOTAL_BYTES) {
      throw new Error("Слишком большой набор файлов — уберите часть фото");
    }

    const created = await api.calculatorOffers.create({
      selectionTitle,
      items: items.map((item) => ({
        vehicleTitle: item.vehicleTitle,
        description: item.description,
        sourceUrl: item.sourceUrl,
        totalLabel: item.totalLabel,
        photos: item.photos.map((photo) => photo.file),
        estimate: item.estimateFile,
      })),
    });
    const url = resolvePublicOfferAbsoluteUrl(created.token);
    const clipboard = buildSelectionLinkClipboard(url, {
      selectionTitle,
      itemCount: items.length,
      firstVehicleTitle: items[0]?.vehicleTitle,
      template: captionTemplate,
    });
    try {
      await navigator.clipboard.writeText(clipboard);
    } catch {
      // ссылку всё равно покажем на экране
    }
    setCreatedLink(url);
    return { url, items };
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const list = await snapshotActive();
      setVariants(list);
      const items = collectFilledItems(list);
      if (items.length === 0) {
        toast.error("Добавьте марку, описание, ссылку, фото или расчёт");
        return;
      }

      if (items.length === 1 && isPhoneFileShare()) {
        const only = items[0]!;
        const previewText = buildOfferShareText({
          vehicleTitle: only.vehicleTitle,
          description: only.description,
          sourceUrl: only.sourceUrl,
          totalLabel: only.totalLabel,
        });
        if (previewText) {
          try {
            await navigator.clipboard.writeText(previewText);
          } catch {
            // на части телефонов буфер недоступен до шаринга
          }
        }
        const files = [
          ...only.photos.map((photo) => photo.file),
          ...(only.estimateFile ? [only.estimateFile] : []),
        ];
        if (files.length > 0) {
          try {
            await shareOfferPackage({
              title: previewText || "Авто из ImportCRM",
              text: previewText,
              files,
            });
            if (previewText) {
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
      }

      await publishOfferLink(list);
      toastCreatedLink(items.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setSharing(false);
    }
  };

  const toastCreatedLink = (itemCount = filledCount) => {
    toast.success(itemCount > 1 ? "Ссылка на подборку создана" : "Ссылка создана", {
      description: "Скопирована в буфер, действует 30 дней.",
      duration: 6000,
    });
    requestAnimationFrame(() => {
      document.getElementById("offer-created-link")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const handleCreateLink = async () => {
    setCreatingLink(true);
    try {
      const list = await snapshotActive();
      setVariants(list);
      const { items } = await publishOfferLink(list);
      toastCreatedLink(items.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setCreatingLink(false);
    }
  };

  const captionInput = {
    selectionTitle,
    itemCount: Math.max(filledCount, 1),
    firstVehicleTitle: collectFilledItems(variants)[0]?.vehicleTitle ?? active.vehicleTitle,
    template: captionTemplate,
  };

  return (
    <div className="space-y-6 pb-36 xl:pb-24">
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Подбор авто</CardTitle>
          <p className="text-sm text-muted-foreground">
            Одно или несколько авто: фото, описание и расчёт. Клиенту уходит одна ссылка на 30 дней.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {variants.map((variant, index) => {
              const selected = variant.id === active.id;
              return (
                <div key={variant.id} className="flex items-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSelectVariant(variant.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-brand bg-brand text-brand-foreground"
                        : "bg-background hover:bg-muted/40",
                    )}
                  >
                    {variantChipLabel(variant, index)}
                  </button>
                  {variants.length > 1 && selected && (
                    <button
                      type="button"
                      disabled={busy}
                      className="-ml-1 rounded-full p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => void handleRemoveVariant(variant.id)}
                      aria-label="Удалить вариант"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {variants.length < OFFER_MAX_ITEMS && (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleAddVariant()}>
                <Plus className="h-3.5 w-3.5" />
                Добавить авто
              </Button>
            )}
          </div>

          {variants.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="offer-selection-title">Название подборки</Label>
              <Input
                id="offer-selection-title"
                value={selectionTitle}
                onChange={(event) => setSelectionTitle(event.target.value.slice(0, OFFER_SELECTION_TITLE_MAX))}
                placeholder="Для Ивана, до 2 млн…"
                maxLength={OFFER_SELECTION_TITLE_MAX}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="offer-photos">
              Фото ({active.photos.length}/{OFFER_MAX_PHOTOS})
            </Label>
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
              {active.photos.map((photo) => (
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
              {active.photos.length < OFFER_MAX_PHOTOS && (
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
            <Label htmlFor="offer-vehicle-title">Марка, модель</Label>
            <Input
              id="offer-vehicle-title"
              value={active.vehicleTitle}
              onChange={(event) => updateActive({ vehicleTitle: event.target.value.slice(0, OFFER_VEHICLE_TITLE_MAX) })}
              placeholder="Toyota Camry, Li L7…"
              maxLength={OFFER_VEHICLE_TITLE_MAX}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-description">Описание</Label>
            <Textarea
              id="offer-description"
              value={active.description}
              onChange={(event) => updateActive({ description: event.target.value.slice(0, OFFER_DESCRIPTION_MAX) })}
              placeholder="Комплектация, состояние, что важно клиенту…"
              rows={6}
              maxLength={OFFER_DESCRIPTION_MAX}
            />
            <p className="text-xs text-muted-foreground">
              {active.description.length}/{OFFER_DESCRIPTION_MAX}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-link">Ссылка на объявление</Label>
            <Input
              id="offer-link"
              type="url"
              inputMode="url"
              value={active.sourceUrl}
              onChange={(event) => updateActive({ sourceUrl: event.target.value })}
              placeholder="https://…"
            />
          </div>
        </CardContent>
      </Card>

      <CustomsCalculator
        key={`${active.id}-${active.calcEpoch}`}
        captureApiRef={captureApiRef}
        embedded
        persistLocal={active.id === variants[0]?.id}
        initialInput={active.calcInput}
        embeddedActions={
          previousVariant ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-2 text-left"
              disabled={busy}
              onClick={handleCopyPreviousSpecs}
            >
              <Copy className="h-3.5 w-3.5 shrink-0" />
              Скопировать характеристики с предыдущего варианта
            </Button>
          ) : null
        }
        onCalculated={(input, result) => {
          const id = activeIdRef.current;
          setVariants((current) =>
            current.map((variant) =>
              variant.id === id
                ? { ...variant, calcInput: input, totalLabel: formatCurrency(result.totalWithCar) }
                : variant,
            ),
          );
        }}
      />

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
                  void navigator.clipboard.writeText(buildSelectionLinkClipboard(createdLink, captionInput));
                  toast.success("Ссылка скопирована");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Копировать ссылку
              </Button>
              <Button type="button" size="sm" variant="brand" asChild>
                <a
                  href={buildTelegramShareUrl(createdLink, buildSelectionLinkCaption(captionInput))}
                  target="_blank"
                  rel="noreferrer"
                >
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
          disabled={busy}
          onClick={() => void handleShare()}
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Поделиться
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full shadow-lg xl:hidden"
          disabled={busy}
          onClick={() => void handleCreateLink()}
        >
          {creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Создать ссылку
        </Button>
      </div>
    </div>
  );
}
