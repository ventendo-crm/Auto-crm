"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchProcessEntryEstimatePanel } from "@/components/deals/search-process-entry-estimate";
import { SearchProcessExchangeRatePanel } from "@/components/deals/search-process-exchange-rate";
import { SearchProcessLinksPanel } from "@/components/deals/search-process-links";
import { DealProcessEntries } from "@/components/deals/deal-process-entries";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { SearchProcessLinks } from "@/lib/types";

interface DealSearchProcessProps {
  dealId: string;
  canEdit?: boolean;
  onChanged?: () => void;
  destinationCountry?: string | null;
}

export function DealSearchProcess({
  dealId,
  canEdit = false,
  onChanged,
  destinationCountry,
}: DealSearchProcessProps) {
  const [links, setLinks] = useState<SearchProcessLinks>({
    inspectionLink: null,
    chinaAutotecaLink: null,
    exchangeRate: null,
  });
  const [estimatesCount, setEstimatesCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const entriesApi = useMemo(
    () => ({
      list: async (id: string) => {
        const data = await api.searchProcess.list(id);
        setLinks(data.links);
        return data.entries;
      },
      create: (id: string) => api.searchProcess.create(id),
      update: (id: string, entryId: string, description: string) =>
        api.searchProcess.update(id, entryId, description),
      delete: (id: string, entryId: string) => api.searchProcess.delete(id, entryId),
      uploadMedia: (id: string, entryId: string, files: File[]) =>
        api.searchProcess.uploadMedia(id, entryId, files),
      publishToClient: (id: string, entryId: string) =>
        api.searchProcess.publishToClient(id, entryId),
      notifyClientUpdate: (id: string, entryId: string) =>
        api.searchProcess.notifyClientUpdate(id, entryId),
    }),
    [],
  );

  const handleEntriesLoaded = useCallback((entries: { estimate?: unknown | null }[]) => {
    setEstimatesCount(entries.filter((entry) => entry.estimate).length);
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      const data = await api.searchProcess.list(dealId);
      setLinks(data.links);
    } catch {
      // ссылки подгрузятся вместе с карточками
    }
  }, [dealId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  return (
    <DealProcessEntries
      dealId={dealId}
      canEdit={canEdit}
      onChanged={onChanged}
      reloadKey={reloadKey}
      onEntriesLoaded={handleEntriesLoaded}
      title="Процесс поиска авто"
      subtitle={`Добавляйте варианты с описанием, фото и видео — до ${MAX_PROCESS_ENTRY_MEDIA} файлов на вариант. Новый вариант сохраняется как черновик; клиент увидит его после «Отправить клиенту».`}
      entryLabel="Вариант"
      emptyText="Вариантов пока нет."
      addButtonText="Добавить вариант"
      addSuccessText="Добавлен новый вариант"
      addErrorText="Не удалось добавить вариант"
      deleteConfirmText="Удалить этот вариант?"
      deleteSuccessText="Вариант удалён"
      loadErrorText="Не удалось загрузить процесс поиска"
      mediaPerEntryLabel="файлов на вариант"
      descriptionPlaceholder="Кратко опишите вариант..."
      hideMediaCaptions
      showPublishActions
      entriesApi={entriesApi}
      showClientFeedback
      renderEntryExtra={({ entry, entryIndex, entries, updateEntry }) => (
        <SearchProcessEntryEstimatePanel
          dealId={dealId}
          entry={entry}
          previousEntry={entries[entryIndex - 1] ?? null}
          destinationCountry={destinationCountry}
          canEdit={canEdit}
          onUpdated={(estimate) => updateEntry({ ...entry, estimate })}
        />
      )}
      headerExtra={
        <div className="space-y-4">
          <SearchProcessExchangeRatePanel
            dealId={dealId}
            links={links}
            destinationCountry={destinationCountry}
            canEdit={canEdit}
            estimatesCount={estimatesCount}
            onLinksUpdated={setLinks}
            onRecalculated={() => setReloadKey((current) => current + 1)}
          />
          <SearchProcessLinksPanel
            dealId={dealId}
            links={links}
            canEdit={canEdit}
            onChanged={onChanged}
            onLinksUpdated={setLinks}
          />
        </div>
      }
    />
  );
}
