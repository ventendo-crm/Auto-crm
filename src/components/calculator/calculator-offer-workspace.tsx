"use client";

import { ClipboardPaste, Copy, ImagePlus, Loader2, Plus, RotateCcw, Send, Share2, X } from "lucide-react";
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
  OFFER_DESCRIPTION_MAX,
  OFFER_MAX_ITEMS,
  OFFER_MAX_PHOTOS,
  OFFER_MAX_TOTAL_BYTES,
  OFFER_SELECTION_TITLE_MAX,
  OFFER_VEHICLE_TITLE_MAX,
  formatOfferMileageInput,
  parseOfferMileageKm,
  resolvePublicOfferAbsoluteUrl,
} from "@/lib/calculator/offer-share";
import type { AdditionalOptionGroupDefinition } from "@/lib/additional-options";
import { snapshotOfferEquipment } from "@/lib/calculator/offer-equipment";
import { isPhoneFileShare, buildOfferShareText, shareOfferPackage } from "@/lib/calculator/share-export";
import type { CustomsCalculatorInput } from "@/lib/customs-calculator";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { cn, formatCurrency } from "@/lib/utils";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const STORAGE_DESCRIPTION = "crm-offer-description";
const STORAGE_TITLE = "crm-offer-vehicle-title";
const STORAGE_LINK = "crm-offer-link";
const STORAGE_SELECTION = "crm-offer-selection-title";
const STORAGE_EQUIPMENT = "crm-offer-equipment";
const STORAGE_MILEAGE = "crm-offer-mileage";

type OfferPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type OfferVariant = {
  id: string;
  vehicleTitle: string;
  mileageKm: number | null;
  description: string;
  equipmentKeys: string[];
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

function extensionForImageType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

function fileFromImageBlob(blob: Blob, index = 0): File {
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const ext = extensionForImageType(type);
  return new File([blob], `clipboard-${Date.now()}-${index}.${ext}`, { type });
}

function filesFromPasteEvent(event: ClipboardEvent): File[] {
  const data = event.clipboardData;
  if (!data) return [];
  const fromFiles = Array.from(data.files).filter(isImageFile);
  if (fromFiles.length > 0) return fromFiles;
  const fromItems: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  return fromItems;
}

async function filesFromClipboardApi(): Promise<File[]> {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.read !== "function") {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((entry) => entry.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(fileFromImageBlob(blob, files.length));
  }
  return files;
}

function createVariantId() {
  return Math.random().toString(36).slice(2, 10);
}

function createVariant(overrides: Partial<OfferVariant> = {}): OfferVariant {
  return {
    id: createVariantId(),
    vehicleTitle: "",
    mileageKm: null,
    description: "",
    equipmentKeys: [],
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
      variant.mileageKm != null ||
      variant.description.trim() ||
      variant.equipmentKeys.length > 0 ||
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

function OfferEquipmentChecklist({
  groups,
  selectedKeys,
  onChange,
  disabled,
}: {
  groups: AdditionalOptionGroupDefinition[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(selectedKeys);
  const toggle = (key: string) => {
    if (selected.has(key)) onChange(selectedKeys.filter((item) => item !== key));
    else onChange([...selectedKeys, key]);
  };

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.options.map((option) => (
              <label key={option.key} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                  checked={selected.has(option.key)}
                  disabled={disabled}
                  onChange={() => toggle(option.key)}
                />
                <span className="leading-snug">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const captionTemplate = settings.offerLinkCaptionTemplate;
  const equipmentGroups = settings.offerEquipmentGroups ?? [];
  const captureApiRef = useRef<CalculatorCaptureApi | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const addPhotosRef = useRef<(fileList: FileList | File[]) => number>(() => 0);
  const [selectionTitle, setSelectionTitle] = useState("");
  const [variants, setVariants] = useState<OfferVariant[]>(() => [createVariant()]);
  const [activeId, setActiveId] = useState(() => variants[0]!.id);
  const [sharing, setSharing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [sendingMax, setSendingMax] = useState(false);
  const [pastingPhotos, setPastingPhotos] = useState(false);
  const busy = sharing || switching;
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
      const storedMileage = parseOfferMileageKm(sessionStorage.getItem(STORAGE_MILEAGE));
      let storedEquipment: string[] = [];
      try {
        storedEquipment = JSON.parse(sessionStorage.getItem(STORAGE_EQUIPMENT) ?? "[]") as string[];
        if (!Array.isArray(storedEquipment)) storedEquipment = [];
      } catch {
        storedEquipment = [];
      }
      setSelectionTitle(sessionStorage.getItem(STORAGE_SELECTION) ?? "");
      if (storedTitle || storedDescription || storedLink || storedEquipment.length > 0 || storedMileage != null) {
        setVariants((current) =>
          current.map((variant, index) =>
            index === 0
              ? {
                  ...variant,
                  vehicleTitle: storedTitle,
                  mileageKm: storedMileage,
                  description: storedDescription,
                  equipmentKeys: storedEquipment.filter((key) => typeof key === "string"),
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
      sessionStorage.setItem(STORAGE_MILEAGE, first?.mileageKm != null ? String(first.mileageKm) : "");
      sessionStorage.setItem(STORAGE_DESCRIPTION, first?.description ?? "");
      sessionStorage.setItem(STORAGE_EQUIPMENT, JSON.stringify(first?.equipmentKeys ?? []));
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

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const files = filesFromPasteEvent(event);
      if (files.length === 0) return;
      event.preventDefault();
      const added = addPhotosRef.current(files);
      if (added > 0) {
        toast.success(added === 1 ? "Фото из буфера добавлено" : `Добавлено фото из буфера: ${added}`);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
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
      return 0;
    }

    const room = OFFER_MAX_PHOTOS - active.photos.length;
    if (room <= 0) {
      toast.error(`Не больше ${OFFER_MAX_PHOTOS} фото`);
      return 0;
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
    return accepted.length;
  };
  addPhotosRef.current = addPhotos;

  const handleAddFromClipboard = async () => {
    if (active.photos.length >= OFFER_MAX_PHOTOS) {
      toast.error(`Не больше ${OFFER_MAX_PHOTOS} фото`);
      return;
    }
    setPastingPhotos(true);
    try {
      const files = await filesFromClipboardApi();
      if (files.length === 0) {
        toast.error("В буфере нет фото. На сайте: правая кнопка → Копировать изображение.");
        return;
      }
      const added = addPhotos(files);
      if (added > 0) {
        toast.success(added === 1 ? "Фото из буфера добавлено" : `Добавлено фото из буфера: ${added}`);
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotFoundError") {
        toast.error("В буфере нет фото. На сайте: правая кнопка → Копировать изображение.");
        return;
      }
      if (name === "NotAllowedError" || (error instanceof Error && error.message === "CLIPBOARD_UNAVAILABLE")) {
        toast.error("Не удалось прочитать буфер. Скопируйте фото и нажмите Ctrl+V (на Mac ⌘V) на этой странице.");
        return;
      }
      toast.error("Не удалось взять фото из буфера");
    } finally {
      setPastingPhotos(false);
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

  const handleClearEquipment = () => {
    if (active.equipmentKeys.length === 0) {
      toast.error("Ничего не отмечено");
      return;
    }
    updateActive({ equipmentKeys: [] });
    toast.success("Галочки комплектации сброшены");
  };

  const handleCopyPreviousEquipment = () => {
    if (!previousVariant) return;
    if (previousVariant.equipmentKeys.length === 0) {
      toast.error("На предыдущем варианте ничего не отмечено");
      return;
    }
    updateActive({ equipmentKeys: [...previousVariant.equipmentKeys] });
    toast.success("Комплектация скопирована с предыдущего варианта");
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
      setCreatedToken(null);
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
      setCreatedToken(null);
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
      throw new Error("Добавьте марку, комплектацию, описание, ссылку, фото или расчёт");
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
        mileageKm: item.mileageKm,
        description: item.description,
        equipmentKeys: item.equipmentKeys,
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
    setCreatedToken(created.token);
    return { url, items };
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const list = await snapshotActive();
      setVariants(list);
      const items = collectFilledItems(list);
      if (items.length === 0) {
        toast.error("Добавьте марку, комплектацию, описание, ссылку, фото или расчёт");
        return;
      }

      if (items.length === 1 && isPhoneFileShare()) {
        const only = items[0]!;
        const previewText = buildOfferShareText({
          vehicleTitle: only.vehicleTitle,
          mileageKm: only.mileageKm,
          description: only.description,
          equipment: snapshotOfferEquipment(only.equipmentKeys, equipmentGroups),
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

  const handleSendToTelegram = async () => {
    if (!createdToken) {
      toast.error("Сначала создайте ссылку");
      return;
    }
    if (!user?.telegramChatId) {
      toast.error("Сначала привяжите Chat ID в Настройки → Профиль");
      return;
    }
    setSendingTelegram(true);
    try {
      await api.calculatorOffers.sendToTelegram(createdToken);
      toast.success("Отправлено в Telegram", {
        description: "Сообщение пришло в бот уведомлений. Перешлите его клиенту из чата с ботом.",
        duration: 7000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить в Telegram");
    } finally {
      setSendingTelegram(false);
    }
  };

  const handleSendToMax = async () => {
    if (!createdToken) {
      toast.error("Сначала создайте ссылку");
      return;
    }
    setSendingMax(true);
    try {
      await api.calculatorOffers.sendToMax(createdToken);
      toast.success("Отправлено в MAX", {
        description: "Сообщение пришло в бот уведомлений. Перешлите его клиенту из чата с ботом.",
        duration: 7000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить в MAX");
    } finally {
      setSendingMax(false);
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

  const captionInput = {
    selectionTitle,
    itemCount: Math.max(filledCount, 1),
    firstVehicleTitle: collectFilledItems(variants)[0]?.vehicleTitle ?? active.vehicleTitle,
    template: captionTemplate,
  };

  return (
    <div className="space-y-6 pb-24">
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Подбор авто</CardTitle>
          <p className="text-sm text-muted-foreground">
            Одно или несколько авто: фото, комплектация и расчёт. Клиенту уходит одна ссылка на 30 дней.
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="offer-photos">
                Фото ({active.photos.length}/{OFFER_MAX_PHOTOS})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || pastingPhotos || active.photos.length >= OFFER_MAX_PHOTOS}
                onClick={() => void handleAddFromClipboard()}
              >
                {pastingPhotos ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ClipboardPaste className="h-3.5 w-3.5" />
                )}
                Добавить из буфера
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Скопируйте картинку на сайте и нажмите кнопку или Ctrl+V (⌘V). Сохранять файл не нужно.
            </p>
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
            <Label htmlFor="offer-mileage">Пробег</Label>
            <Input
              id="offer-mileage"
              inputMode="numeric"
              value={formatOfferMileageInput(active.mileageKm)}
              onChange={(event) => updateActive({ mileageKm: parseOfferMileageKm(event.target.value) })}
              placeholder="49 000"
            />
          </div>

          <div className="space-y-2">
            <Label>Комплектация</Label>
            <p className="text-xs text-muted-foreground">
              Что уже стоит на этом авто. Список правит администратор в{" "}
              <span className="whitespace-nowrap">Настройки → Компания</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              {previousVariant ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal py-2 text-left"
                  disabled={busy}
                  onClick={handleCopyPreviousEquipment}
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  Скопировать комплектацию с предыдущего варианта
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal py-2 text-left"
                disabled={busy || active.equipmentKeys.length === 0}
                onClick={handleClearEquipment}
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                Сбросить выбранные галочки с комплектации
              </Button>
            </div>
            <OfferEquipmentChecklist
              groups={equipmentGroups}
              selectedKeys={active.equipmentKeys}
              disabled={busy}
              onChange={(equipmentKeys) => updateActive({ equipmentKeys })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-description">Комментарий</Label>
            <Textarea
              id="offer-description"
              value={active.description}
              onChange={(event) => updateActive({ description: event.target.value.slice(0, OFFER_DESCRIPTION_MAX) })}
              placeholder="Состояние, что важно клиенту…"
              rows={4}
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
              <Button
                type="button"
                size="sm"
                variant="brand"
                disabled={sendingTelegram}
                onClick={() => void handleSendToTelegram()}
              >
                {sendingTelegram ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Отправить в Telegram
              </Button>
              <Button
                type="button"
                size="sm"
                variant="brand"
                disabled={sendingMax}
                onClick={() => void handleSendToMax()}
              >
                {sendingMax ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Отправить в МАКС
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
      </div>
    </div>
  );
}
