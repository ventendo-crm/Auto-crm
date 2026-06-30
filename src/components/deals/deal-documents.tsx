"use client";

import { DocumentType } from "@prisma/client";
import { CheckCircle2, Download, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import {
  DOCUMENT_LABELS,
  CLIENT_DOCUMENT_ORDER,
  DOCUMENT_STATUS_LABELS,
  PASSPORT_DOCUMENT_TYPES,
  PASSPORT_FILE_LABELS,
} from "@/lib/constants";
import { canUploadDealDocuments, getClientRoleName } from "@/lib/permissions";
import { DocumentItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const DEFAULT_DOCUMENT_TYPES: DocumentType[] = [...CLIENT_DOCUMENT_ORDER];

export const RECEIVED_DEAL_DOCUMENT_TYPES: DocumentType[] = ["EPTS", "PTD", "SBKTS"];

const ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp";

const statusColors = {
  MISSING: "bg-muted text-muted-foreground",
  RECEIVED:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  VERIFIED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
};

function getFileNameFromUrl(fileUrl: string): string {
  const segment = fileUrl.split("?")[0].split("/").pop() ?? "document";
  const match = segment.match(/^\d+-(.+)$/);
  return match?.[1] ?? segment;
}

function isLocalUpload(fileUrl: string): boolean {
  return fileUrl.startsWith("/api/uploads/");
}

function getDocumentFileUrl(dealId: string, type: DocumentType, download: boolean): string {
  const base = `/api/deals/${dealId}/documents/${type}/file`;
  return download ? `${base}?download=1` : base;
}

function getDownloadUrl(dealId: string, type: DocumentType, fileUrl: string): string {
  return isLocalUpload(fileUrl) ? getDocumentFileUrl(dealId, type, true) : fileUrl;
}

type DisplayEntry =
  | { kind: "single"; type: DocumentType }
  | { kind: "passport" };

function buildDisplayEntries(types: readonly DocumentType[]): DisplayEntry[] {
  const entries: DisplayEntry[] = [];

  for (const type of types) {
    if (type === "PASSPORT_2") continue;
    if (type === "PASSPORT") {
      entries.push({ kind: "passport" });
      continue;
    }
    entries.push({ kind: "single", type });
  }

  return entries;
}

interface DealDocumentsProps {
  dealId: string;
  documents: DocumentItem[];
  managerId: string | null;
  clientUserId?: string | null;
  title?: string;
  documentTypes?: readonly DocumentType[];
  onUpdated?: () => void;
  canUpload?: boolean;
  canVerify?: boolean;
}

interface DocumentSlotProps {
  dealId: string;
  type: DocumentType;
  doc?: DocumentItem;
  slotLabel?: string;
  compact?: boolean;
  canUpload: boolean;
  canVerify: boolean;
  uploadingType: DocumentType | null;
  statusUpdatingType: DocumentType | null;
  inputRef: (el: HTMLInputElement | null) => void;
  onPickFile: () => void;
  onUpload: (type: DocumentType, file: File) => void;
  onStatusChange: (type: DocumentType, status: "RECEIVED" | "VERIFIED") => void;
}

function DocumentSlot({
  dealId,
  type,
  doc,
  slotLabel,
  compact = false,
  canUpload,
  canVerify,
  uploadingType,
  statusUpdatingType,
  inputRef,
  onPickFile,
  onUpload,
  onStatusChange,
}: DocumentSlotProps) {
  const hasFile = Boolean(doc?.fileUrl);
  const fileName = doc?.fileUrl ? getFileNameFromUrl(doc.fileUrl) : null;
  const isUploading = uploadingType === type;
  const isUpdatingStatus = statusUpdatingType === type;

  return (
    <div
      className={
        compact
          ? "rounded-lg border bg-muted/10 p-3"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className={compact ? "space-y-2" : "flex min-w-0 flex-1 items-start gap-3"}>
        {!compact && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {slotLabel ?? DOCUMENT_LABELS[type as keyof typeof DOCUMENT_LABELS] ?? type}
            </p>
            <Badge variant="outline" className={statusColors[doc?.status ?? "MISSING"]}>
              {DOCUMENT_STATUS_LABELS[doc?.status ?? "MISSING"]}
            </Badge>
          </div>

          {hasFile && fileName && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{fileName}</p>
          )}

          {doc?.uploadedAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Загружен: {formatDateTime(doc.uploadedAt)}
            </p>
          )}

          {!hasFile && (
            <p className="mt-1 text-xs text-muted-foreground">Файл не загружен</p>
          )}
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "sm:shrink-0"}`}>
        {hasFile && doc?.fileUrl && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={getDownloadUrl(dealId, type, doc.fileUrl)}
              download={isLocalUpload(doc.fileUrl) ? (fileName ?? undefined) : undefined}
            >
              <Download className="h-4 w-4" />
              Скачать
            </a>
          </Button>
        )}

        {canVerify && hasFile && doc?.status === "RECEIVED" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdatingStatus}
            onClick={() => onStatusChange(type, "VERIFIED")}
          >
            {isUpdatingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Проверить
          </Button>
        )}

        {canVerify && hasFile && doc?.status === "VERIFIED" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdatingStatus}
            onClick={() => onStatusChange(type, "RECEIVED")}
          >
            {isUpdatingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Снять проверку
          </Button>
        )}

        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(type, file);
              }}
            />

            <Button
              variant={hasFile ? "outline" : "brand"}
              size="sm"
              disabled={isUploading}
              onClick={onPickFile}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {hasFile ? "Заменить" : "Загрузить"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function DealDocuments({
  dealId,
  documents,
  managerId,
  clientUserId = null,
  title = "Документы клиента",
  documentTypes = DEFAULT_DOCUMENT_TYPES,
  onUpdated,
  canUpload: canUploadProp,
  canVerify: canVerifyProp = false,
}: DealDocumentsProps) {
  const { user } = useAuth();
  const inputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [statusUpdatingType, setStatusUpdatingType] = useState<DocumentType | null>(null);

  const role = getClientRoleName(user);
  const canUpload =
    canUploadProp ??
    Boolean(
      user &&
        role &&
        canUploadDealDocuments(role, user.id, { managerId, clientUserId }),
    );
  const canVerify = canVerifyProp;

  const documentsByType = Object.fromEntries(
    documents.map((doc) => [doc.type, doc]),
  ) as Partial<Record<DocumentType, DocumentItem>>;

  const displayEntries = buildDisplayEntries(documentTypes);

  const handleUpload = async (type: DocumentType, file: File) => {
    setUploadingType(type);
    try {
      await api.documents.upload(dealId, type, file);
      const label =
        type === "PASSPORT" || type === "PASSPORT_2"
          ? `Паспорт (${PASSPORT_FILE_LABELS[type === "PASSPORT" ? 0 : 1]})`
          : DOCUMENT_LABELS[type as keyof typeof DOCUMENT_LABELS] ?? type;
      toast.success(`${label} загружен`);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploadingType(null);
      const input = inputRefs.current[type];
      if (input) input.value = "";
    }
  };

  const handleStatusChange = async (type: DocumentType, status: "RECEIVED" | "VERIFIED") => {
    setStatusUpdatingType(type);
    try {
      await api.documents.updateStatus(dealId, type, status);
      toast.success(
        status === "VERIFIED"
          ? `${DOCUMENT_LABELS[type as keyof typeof DOCUMENT_LABELS] ?? type} проверен`
          : "Проверка снята",
      );
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка обновления статуса");
    } finally {
      setStatusUpdatingType(null);
    }
  };

  const slotProps = (type: DocumentType) => ({
    dealId,
    type,
    doc: documentsByType[type],
    canUpload,
    canVerify,
    uploadingType,
    statusUpdatingType,
    inputRef: (el: HTMLInputElement | null) => {
      inputRefs.current[type] = el;
    },
    onPickFile: () => inputRefs.current[type]?.click(),
    onUpload: (uploadType: DocumentType, file: File) => void handleUpload(uploadType, file),
    onStatusChange: (changeType: DocumentType, status: "RECEIVED" | "VERIFIED") =>
      void handleStatusChange(changeType, status),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayEntries.map((entry) => {
          if (entry.kind === "passport") {
            return (
              <div key="passport" className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Паспорт</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Можно загрузить 2 файла (например, разворот и прописку)
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {PASSPORT_DOCUMENT_TYPES.map((type, index) => (
                    <DocumentSlot
                      key={type}
                      {...slotProps(type)}
                      compact
                      slotLabel={PASSPORT_FILE_LABELS[index]}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={entry.type} className="rounded-lg border p-4">
              <DocumentSlot {...slotProps(entry.type)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
