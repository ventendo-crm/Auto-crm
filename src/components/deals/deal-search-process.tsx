"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchProcessLinksPanel } from "@/components/deals/search-process-links";
import { DealProcessEntries } from "@/components/deals/deal-process-entries";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { SearchProcessLinks } from "@/lib/types";

interface DealSearchProcessProps {
  dealId: string;
  canEdit?: boolean;
  onChanged?: () => void;
}

export function DealSearchProcess({ dealId, canEdit = false, onChanged }: DealSearchProcessProps) {
  const [links, setLinks] = useState<SearchProcessLinks>({
    inspectionLink: null,
    chinaAutotecaLink: null,
  });

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
    }),
    [],
  );

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
      title="Процесс поиска авто"
      subtitle={`Добавляйте варианты с описанием, фото и видео — до ${MAX_PROCESS_ENTRY_MEDIA} файлов на вариант.`}
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
      entriesApi={entriesApi}
      showClientFeedback
      headerExtra={
        <SearchProcessLinksPanel
          dealId={dealId}
          links={links}
          canEdit={canEdit}
          onChanged={onChanged}
          onLinksUpdated={setLinks}
        />
      }
    />
  );
}
