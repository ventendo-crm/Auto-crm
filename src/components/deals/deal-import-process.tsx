"use client";

import { useMemo } from "react";
import { CarCarrierTracking } from "@/components/deals/car-carrier-tracking";
import { DealProcessEntries } from "@/components/deals/deal-process-entries";
import { MAX_PROCESS_ENTRY_MEDIA } from "@/lib/constants";
import { api } from "@/lib/api-client";

interface DealImportProcessProps {
  dealId: string;
  canEdit?: boolean;
  onChanged?: () => void;
}

export function DealImportProcess({ dealId, canEdit = false, onChanged }: DealImportProcessProps) {
  const entriesApi = useMemo(
    () => ({
      list: (id: string) => api.importProcess.listEntries(id),
      create: (id: string) => api.importProcess.createEntry(id),
      update: (id: string, entryId: string, description: string) =>
        api.importProcess.updateEntry(id, entryId, description),
      delete: (id: string, entryId: string) => api.importProcess.deleteEntry(id, entryId),
      uploadMedia: (id: string, entryId: string, files: File[]) =>
        api.importProcess.uploadMedia(id, entryId, files),
    }),
    [],
  );

  return (
    <div className="space-y-4">
      <CarCarrierTracking dealId={dealId} canEdit={canEdit} />
      <DealProcessEntries
      dealId={dealId}
      canEdit={canEdit}
      onChanged={onChanged}
      title="Процесс импорта авто"
      subtitle={`Добавляйте этапы с описанием, фото и видео — до ${MAX_PROCESS_ENTRY_MEDIA} файлов на этап.`}
      entryLabel="Этап"
      emptyText="Этапов пока нет."
      addButtonText="Добавить этап"
      addSuccessText="Добавлен новый этап"
      addErrorText="Не удалось добавить этап"
      deleteConfirmText="Удалить этот этап?"
      deleteSuccessText="Этап удалён"
      loadErrorText="Не удалось загрузить процесс импорта"
      mediaPerEntryLabel="файлов на этап"
      descriptionPlaceholder="Кратко опишите этап импорта..."
      entriesApi={entriesApi}
      />
    </div>
  );
}
