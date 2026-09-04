"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DealStageType } from "@prisma/client";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { getDefaultCompanyWorkspace } from "@/lib/company-workspace/defaults";
import { getDocumentLabel } from "@/lib/company-workspace/helpers";
import type {
  CompanyModuleKey,
  CompanyWorkspaceDto,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";

interface CompanyWorkspaceState {
  settings: ResolvedCompanyWorkspace;
  companyId: string | null;
  updatedAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applyLocal: (next: CompanyWorkspaceDto) => void;
  stageLabel: (stage: DealStageType) => string;
  documentLabel: (type: string) => string;
  moduleEnabled: (key: CompanyModuleKey) => boolean;
}

const CompanyWorkspaceContext = createContext<CompanyWorkspaceState | null>(null);

function dtoToSettings(dto: CompanyWorkspaceDto): ResolvedCompanyWorkspace {
  return {
    stageLabels: dto.stageLabels,
    clientVisibleStages: dto.clientVisibleStages,
    dealTabs: dto.dealTabs,
    dealFields: dto.dealFields,
    customDealFields: dto.customDealFields,
    documentTypes: dto.documentTypes,
    additionalOptionGroups: dto.additionalOptionGroups,
    modules: dto.modules,
  };
}

export function CompanyWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<ResolvedCompanyWorkspace>(getDefaultCompanyWorkspace);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyLocal = useCallback((next: CompanyWorkspaceDto) => {
    setSettings(dtoToSettings(next));
    setCompanyId(next.companyId);
    setUpdatedAt(next.updatedAt);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(getDefaultCompanyWorkspace());
      setCompanyId(null);
      setUpdatedAt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.companyWorkspace.get();
      applyLocal(data);
    } catch {
      // оставляем текущие значения
    } finally {
      setLoading(false);
    }
  }, [user, applyLocal]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo<CompanyWorkspaceState>(
    () => ({
      settings,
      companyId,
      updatedAt,
      loading,
      refresh,
      applyLocal,
      stageLabel: (stage) => settings.stageLabels[stage],
      documentLabel: (type) => getDocumentLabel(type, settings.documentTypes),
      moduleEnabled: (key) => settings.modules[key],
    }),
    [settings, companyId, updatedAt, loading, refresh, applyLocal],
  );

  return (
    <CompanyWorkspaceContext.Provider value={value}>{children}</CompanyWorkspaceContext.Provider>
  );
}

export function useCompanyWorkspace() {
  const context = useContext(CompanyWorkspaceContext);
  if (!context) {
    throw new Error("useCompanyWorkspace must be used within CompanyWorkspaceProvider");
  }
  return context;
}
