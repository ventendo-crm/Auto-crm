"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyBrandCssVars,
  clearBrandCssVars,
  DEFAULT_BRAND_HSL,
} from "@/lib/appearance/presets";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

export interface CompanyAppearanceState {
  presetId: string;
  customBrandHsl: string | null;
  brandHsl: string;
  hasLogo: boolean;
  logoSrc: string | null;
  updatedAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applyLocal: (next: {
    presetId: string;
    customBrandHsl: string | null;
    brandHsl: string;
    hasLogo: boolean;
    updatedAt: string | null;
  }) => void;
}

const CompanyAppearanceContext = createContext<CompanyAppearanceState | null>(null);

function logoSrcFrom(hasLogo: boolean, updatedAt: string | null): string | null {
  if (!hasLogo) return null;
  const v = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
  return `/api/company/appearance/logo${v}`;
}

export function CompanyAppearanceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [presetId, setPresetId] = useState("classic");
  const [customBrandHsl, setCustomBrandHsl] = useState<string | null>(null);
  const [brandHsl, setBrandHsl] = useState(DEFAULT_BRAND_HSL);
  const [hasLogo, setHasLogo] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyLocal = useCallback(
    (next: {
      presetId: string;
      customBrandHsl: string | null;
      brandHsl: string;
      hasLogo: boolean;
      updatedAt: string | null;
    }) => {
      setPresetId(next.presetId);
      setCustomBrandHsl(next.customBrandHsl);
      setBrandHsl(next.brandHsl);
      setHasLogo(next.hasLogo);
      setUpdatedAt(next.updatedAt);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setPresetId("classic");
      setCustomBrandHsl(null);
      setBrandHsl(DEFAULT_BRAND_HSL);
      setHasLogo(false);
      setUpdatedAt(null);
      setLoading(false);
      clearBrandCssVars();
      return;
    }

    setLoading(true);
    try {
      const data = await api.companyAppearance.get();
      applyLocal({
        presetId: data.presetId,
        customBrandHsl: data.customBrandHsl,
        brandHsl: data.brandHsl,
        hasLogo: data.hasLogo,
        updatedAt: data.updatedAt,
      });
    } catch {
      // оставляем значения по умолчанию
    } finally {
      setLoading(false);
    }
  }, [user, applyLocal]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  useEffect(() => {
    if (!user) {
      clearBrandCssVars();
      return;
    }
    applyBrandCssVars(brandHsl, theme === "dark");
  }, [user, brandHsl, theme]);

  const value = useMemo(
    () => ({
      presetId,
      customBrandHsl,
      brandHsl,
      hasLogo,
      logoSrc: logoSrcFrom(hasLogo, updatedAt),
      updatedAt,
      loading,
      refresh,
      applyLocal,
    }),
    [
      presetId,
      customBrandHsl,
      brandHsl,
      hasLogo,
      updatedAt,
      loading,
      refresh,
      applyLocal,
    ],
  );

  return (
    <CompanyAppearanceContext.Provider value={value}>
      {children}
    </CompanyAppearanceContext.Provider>
  );
}

export function useCompanyAppearance() {
  const context = useContext(CompanyAppearanceContext);
  if (!context) {
    throw new Error("useCompanyAppearance must be used within CompanyAppearanceProvider");
  }
  return context;
}
