"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyAppearance } from "@/hooks/use-company-appearance";
import { useTheme } from "@/hooks/use-theme";
import {
  APPEARANCE_PRESETS,
  CUSTOM_PRESET_ID,
  applyBrandCssVars,
  brandHslToHex,
  hexToBrandHsl,
  persistBrandCache,
  resolveBrandHsl,
} from "@/lib/appearance/presets";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function AppearancePanel() {
  const { user } = useAuth();
  const { applyLocal, logoSrc, hasLogo: ctxHasLogo } = useCompanyAppearance();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [presetId, setPresetId] = useState("classic");
  const [customBrandHsl, setCustomBrandHsl] = useState(
    APPEARANCE_PRESETS[0]?.brandHsl ?? "14 100% 67%",
  );
  const [hasLogo, setHasLogo] = useState(false);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedBrandRef = useRef(APPEARANCE_PRESETS[0]?.brandHsl ?? "14 100% 67%");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.companyAppearance.get();
      setPresetId(data.presetId);
      setCustomBrandHsl(data.customBrandHsl ?? data.brandHsl);
      setHasLogo(data.hasLogo);
      setPreviewUpdatedAt(data.updatedAt);
      savedBrandRef.current = data.brandHsl;
      applyLocal({
        presetId: data.presetId,
        customBrandHsl: data.customBrandHsl,
        brandHsl: data.brandHsl,
        hasLogo: data.hasLogo,
        updatedAt: data.updatedAt,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить оформление");
    } finally {
      setLoading(false);
    }
  }, [applyLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewBrand = resolveBrandHsl(presetId, customBrandHsl);

  useEffect(() => {
    if (loading) return;
    applyBrandCssVars(previewBrand, theme === "dark");
    return () => {
      applyBrandCssVars(savedBrandRef.current, theme === "dark");
    };
  }, [loading, previewBrand, theme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.companyAppearance.save({
        presetId,
        customBrandHsl: customBrandHsl,
      });
      setPresetId(data.presetId);
      setCustomBrandHsl(data.customBrandHsl ?? data.brandHsl);
      setHasLogo(data.hasLogo);
      setPreviewUpdatedAt(data.updatedAt);
      savedBrandRef.current = data.brandHsl;
      applyLocal({
        presetId: data.presetId,
        customBrandHsl: data.customBrandHsl,
        brandHsl: data.brandHsl,
        hasLogo: data.hasLogo,
        updatedAt: data.updatedAt,
      });
      const companyId = user?.companyId ?? user?.company?.id;
      if (companyId) {
        persistBrandCache(companyId, data.brandHsl);
      }
      toast.success("Оформление сохранено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const data = await api.companyAppearance.uploadLogo(file);
      setHasLogo(data.hasLogo);
      setPreviewUpdatedAt(data.updatedAt);
      applyLocal({
        presetId: data.presetId,
        customBrandHsl: data.customBrandHsl,
        brandHsl: data.brandHsl,
        hasLogo: data.hasLogo,
        updatedAt: data.updatedAt,
      });
      toast.success("Логотип загружен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить логотип");
    } finally {
      setLogoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleLogoClear = async () => {
    setLogoUploading(true);
    try {
      const data = await api.companyAppearance.clearLogo();
      setHasLogo(false);
      setPreviewUpdatedAt(data.updatedAt);
      applyLocal({
        presetId: data.presetId,
        customBrandHsl: data.customBrandHsl,
        brandHsl: data.brandHsl,
        hasLogo: false,
        updatedAt: data.updatedAt,
      });
      toast.success("Логотип удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить логотип");
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const logoPreview =
    hasLogo || ctxHasLogo
      ? `/api/company/appearance/logo${previewUpdatedAt ? `?v=${encodeURIComponent(previewUpdatedAt)}` : ""}`
      : logoSrc;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Оформление компании</CardTitle>
        <CardDescription className="mt-1.5">
          Акцент, кнопки и логотип в боковой панели — общие для всех сотрудников. Светлую и тёмную
          тему каждый выбирает себе сам.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-2 block">Пресет</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {APPEARANCE_PRESETS.map((preset) => {
              const swatch =
                preset.id === CUSTOM_PRESET_ID
                  ? customBrandHsl
                  : (preset.brandHsl ?? customBrandHsl);
              const selected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-brand bg-brand-muted ring-1 ring-brand"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-black/10"
                    style={{ backgroundColor: `hsl(${swatch})` }}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm font-medium">{preset.name}</span>
                    <span className="block text-xs text-muted-foreground">{preset.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {presetId === CUSTOM_PRESET_ID && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="brand-color">Свой цвет</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="brand-color"
                  type="color"
                  className="h-10 w-14 cursor-pointer p-1"
                  value={brandHslToHex(customBrandHsl)}
                  onChange={(e) => setCustomBrandHsl(hexToBrandHsl(e.target.value))}
                />
                <Input
                  className="w-36 font-mono text-xs"
                  value={customBrandHsl}
                  onChange={(e) => setCustomBrandHsl(e.target.value)}
                  placeholder="14 100% 67%"
                />
              </div>
            </div>
            <div className="rounded-md border px-3 py-2 text-sm">
              Превью:{" "}
              <Button type="button" variant="brand" size="sm" className="ml-1 pointer-events-none">
                Кнопка
              </Button>
              <span
                className="ml-2 inline-block h-3 w-3 rounded-full align-middle"
                style={{ backgroundColor: `hsl(${previewBrand})` }}
              />
            </div>
          </div>
        )}

        <div>
          <Label className="mb-2 block">Логотип в меню</Label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="max-h-14 max-w-14 object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">По умолчанию</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={() => fileRef.current?.click()}
              >
                {logoUploading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                Загрузить
              </Button>
              {hasLogo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => void handleLogoClear()}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Убрать
                </Button>
              )}
            </div>
            <p className="w-full text-xs text-muted-foreground">PNG, JPEG или WebP до 2 МБ.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="brand" disabled={saving} onClick={() => void handleSave()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Сохранить оформление
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
