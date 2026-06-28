"use client";

import { DocumentType } from "@prisma/client";
import { CheckCircle2, Download, ExternalLink, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { DOCUMENT_LABELS, DOCUMENT_ORDER, DOCUMENT_STATUS_LABELS } from "@/lib/constants";
import { canManageDealClient } from "@/lib/permissions";
import { DocumentItem } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const DOCUMENT_TYPES: DocumentType[] = DOCUMENT_ORDER.map((type) => type as DocumentType);

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

function getOpenUrl(dealId: string, type: DocumentType, fileUrl: string): string {
  return isLocalUpload(fileUrl) ? getDocumentFileUrl(dealId, type, false) : fileUrl;
}

interface DealDocumentsProps {
  dealId: string;
  documents: DocumentItem[];
  managerId: string | null;
  onUpdated?: () => void;
  canUpload?: boolean;
  canVerify?: boolean;
}

export function DealDocuments({
  dealId,
  documents,
  managerId,
  onUpdated,
  canUpload: canUploadProp,
  canVerify: canVerifyProp = false,
}: DealDocumentsProps) {
  const { user } = useAuth();
  const inputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [statusUpdatingType, setStatusUpdatingType] = useState<DocumentType | null>(null);

  const canUpload = canUploadProp ?? canManageDealClient(user, managerId);
  const canVerify = canVerifyProp;

  const documentsByType = Object.fromEntries(
    documents.map((doc) => [doc.type, doc]),
  ) as Partial<Record<DocumentType, DocumentItem>>;

  const handleUpload = async (type: DocumentType, file: File) => {
    setUploadingType(type);
    try {
      await api.documents.upload(dealId, type, file);
      toast.success(`${DOCUMENT_LABELS[type]} загружен`);
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
        status === "VERIFIED" ? `${DOCUMENT_LABELS[type]} проверен` : "Проверка снята",
      );
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка обновления статуса");
    } finally {
      setStatusUpdatingType(null);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Документы клиента</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DOCUMENT_TYPES.map((type) => {
          const doc = documentsByType[type];
          const hasFile = Boolean(doc?.fileUrl);
          const fileName = doc?.fileUrl ? getFileNameFromUrl(doc.fileUrl) : null;
          const isUploading = uploadingType === type;
          const isUpdatingStatus = statusUpdatingType === type;

          return (
            <div
              key={type}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{DOCUMENT_LABELS[type]}</p>
                    <Badge
                      variant="outline"
                      className={statusColors[doc?.status ?? "MISSING"]}
                    >
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

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {hasFile && doc?.fileUrl && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={getOpenUrl(dealId, type, doc.fileUrl)} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Открыть
                      </a>
                    </Button>

                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={getDownloadUrl(dealId, type, doc.fileUrl)}
                        download={isLocalUpload(doc.fileUrl) ? (fileName ?? undefined) : undefined}
                      >
                        <Download className="h-4 w-4" />
                        Скачать
                      </a>
                    </Button>
                  </>
                )}

                {canVerify && hasFile && doc?.status === "RECEIVED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUpdatingStatus}
                    onClick={() => void handleStatusChange(type, "VERIFIED")}
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
                    onClick={() => void handleStatusChange(type, "RECEIVED")}
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
                      ref={(el) => {
                        inputRefs.current[type] = el;
                      }}
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(type, file);
                      }}
                    />

                    <Button
                      variant={hasFile ? "outline" : "brand"}
                      size="sm"
                      disabled={isUploading}
                      onClick={() => inputRefs.current[type]?.click()}
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
        })}
      </CardContent>
    </Card>
  );
}
