import { DealStageType } from "@prisma/client";
import { DOCUMENT_LABELS, STAGE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { listStageHistory } from "@/lib/services/stage-history";

export interface DealActivityItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  title: string;
  description?: string;
  category: "stage" | "deal" | "document" | "media" | "search" | "comment" | "options";
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function variantLabel(value: JsonRecord | null): string | undefined {
  const number = value?.variantNumber;
  if (typeof number === "number" && number > 0) {
    return `Вариант ${number}`;
  }
  const sortOrder = value?.sortOrder;
  if (typeof sortOrder === "number") {
    return `Вариант ${sortOrder + 1}`;
  }
  return undefined;
}

function processStepLabel(value: JsonRecord | null): string | undefined {
  if (!value) return undefined;
  const stageNumber = value.stageNumber;
  if (typeof stageNumber === "number" && stageNumber > 0) {
    return `Этап ${stageNumber}`;
  }
  return variantLabel(value);
}

function formatStageHistory(item: {
  id: string;
  fromStage: DealStageType;
  toStage: DealStageType;
  createdAt: Date;
  changedBy: { id: string; name: string; email: string };
}): DealActivityItem {
  if (item.fromStage === item.toStage) {
    return {
      id: `stage-${item.id}`,
      createdAt: item.createdAt.toISOString(),
      user: item.changedBy,
      title: "Сделка создана",
      description: `Начальный этап: ${STAGE_LABELS[item.toStage]}`,
      category: "stage",
    };
  }

  return {
    id: `stage-${item.id}`,
    createdAt: item.createdAt.toISOString(),
    user: item.changedBy,
    title: "Изменение этапа",
    description: `${STAGE_LABELS[item.fromStage]} → ${STAGE_LABELS[item.toStage]}`,
    category: "stage",
  };
}

function formatAuditLog(log: {
  id: string;
  entity: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}): DealActivityItem | null {
  const newValue = asRecord(log.newValue);
  const oldValue = asRecord(log.oldValue);
  const key = `${log.entity}:${log.action}`;

  switch (key) {
    case "Deal:CREATE":
      return null;
    case "Deal:UPDATE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Данные клиента обновлены",
        category: "deal",
      };
    case "Deal:STAGE_CHANGE":
      return null;
    case "Deal:IMPORT_PROCESS_ENABLED":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Активирован процесс импорта авто",
        category: "deal",
      };
    case "Deal:IMPORT_PROCESS_DISABLED":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Скрыт процесс импорта авто",
        category: "deal",
      };
    case "Deal:SEARCH_LINKS_UPDATE": {
      const oldInspection = oldValue?.inspectionLink ? String(oldValue.inspectionLink) : "";
      const newInspection = newValue?.inspectionLink ? String(newValue.inspectionLink) : "";
      const oldChina = oldValue?.chinaAutotecaLink ? String(oldValue.chinaAutotecaLink) : "";
      const newChina = newValue?.chinaAutotecaLink ? String(newValue.chinaAutotecaLink) : "";

      if (oldInspection !== newInspection) {
        let title: string;
        if (!oldInspection && newInspection) {
          title = "Добавлен отчет о проверке авто";
        } else if (oldInspection && !newInspection) {
          title = "Удален отчет о проверке авто";
        } else {
          title = "Обновлен отчет о проверке авто";
        }

        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title,
          description: newInspection ? truncate(newInspection) : truncate(oldInspection),
          category: "search",
        };
      }

      if (oldChina !== newChina) {
        let title: string;
        if (!oldChina && newChina) {
          title = "Добавлена ссылка китайской автотеки";
        } else if (oldChina && !newChina) {
          title = "Удалена ссылка китайской автотеки";
        } else {
          title = "Обновлена ссылка китайской автотеки";
        }

        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title,
          description: newChina ? truncate(newChina) : truncate(oldChina),
          category: "search",
        };
      }

      return null;
    }
    case "SearchProcessEntry:CREATE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Добавлен вариант в процесс поиска",
        description: variantLabel(newValue),
        category: "search",
      };
    case "SearchProcessEntry:UPDATE": {
      const description = newValue?.description
        ? truncate(String(newValue.description))
        : variantLabel(newValue);
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Обновлено описание варианта",
        description,
        category: "search",
      };
    }
    case "SearchProcessEntry:CLIENT_FEEDBACK": {
      const variant = variantLabel(newValue);
      const feedback = newValue?.clientFeedback
        ? truncate(String(newValue.clientFeedback))
        : undefined;
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Обратная связь по варианту поиска",
        description: [variant, feedback].filter(Boolean).join(" · "),
        category: "search",
      };
    }
    case "SearchProcessEntry:DELETE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Удалён вариант из процесса поиска",
        description: variantLabel(oldValue),
        category: "search",
      };
    case "ImportProcessEntry:CREATE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Добавлен этап процесса импорта",
        description: processStepLabel(newValue),
        category: "deal",
      };
    case "ImportProcessEntry:UPDATE": {
      const description = newValue?.description
        ? truncate(String(newValue.description))
        : processStepLabel(newValue);
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Обновлено описание этапа импорта",
        description,
        category: "deal",
      };
    }
    case "ImportProcessEntry:DELETE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Удалён этап процесса импорта",
        description: processStepLabel(oldValue),
        category: "deal",
      };
    case "Document:UPLOAD": {
      const docType = newValue?.type ? String(newValue.type) : "";
      const label =
        docType in DOCUMENT_LABELS
          ? DOCUMENT_LABELS[docType as keyof typeof DOCUMENT_LABELS]
          : docType;
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Загружен документ",
        description: label || undefined,
        category: "document",
      };
    }
    case "MediaFile:CREATE": {
      const fileName = newValue?.fileName ? String(newValue.fileName) : undefined;
      if (newValue?.importProcessEntryId) {
        const stage = processStepLabel(newValue);
        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title: "Загружено фото/видео в процесс импорта",
          description: [stage, fileName].filter(Boolean).join(" · "),
          category: "deal",
        };
      }
      if (newValue?.searchProcessEntryId) {
        const variant = variantLabel(newValue);
        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title: "Загружено фото/видео в процесс поиска",
          description: [variant, fileName].filter(Boolean).join(" · "),
          category: "search",
        };
      }
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Загружено медиа",
        description: fileName,
        category: "media",
      };
    }
    case "MediaFile:DELETE": {
      const fileName = oldValue?.fileName ? String(oldValue.fileName) : undefined;
      if (oldValue?.importProcessEntryId) {
        const stage = processStepLabel(oldValue);
        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title: "Удалено фото/видео из процесса импорта",
          description: [stage, fileName].filter(Boolean).join(" · "),
          category: "deal",
        };
      }
      if (oldValue?.searchProcessEntryId) {
        const variant = variantLabel(oldValue);
        return {
          id: `audit-${log.id}`,
          createdAt: log.createdAt.toISOString(),
          user: log.user,
          title: "Удалено фото/видео из процесса поиска",
          description: [variant, fileName].filter(Boolean).join(" · "),
          category: "search",
        };
      }
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Удалено медиа",
        description: fileName,
        category: "media",
      };
    }
    case "Comment:CREATE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Новое сообщение",
        description: newValue?.text ? truncate(String(newValue.text)) : undefined,
        category: "comment",
      };
    case "Comment:UPDATE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Сообщение изменено",
        description: newValue?.text ? truncate(String(newValue.text)) : undefined,
        category: "comment",
      };
    case "Comment:DELETE":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Сообщение удалено",
        category: "comment",
      };
    case "DealAdditionalOption:CHECK":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Отмечена дополнительная опция",
        description: newValue?.optionLabel ? String(newValue.optionLabel) : undefined,
        category: "options",
      };
    case "DealAdditionalOption:UNCHECK":
      return {
        id: `audit-${log.id}`,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        title: "Снята отметка с дополнительной опции",
        description: oldValue?.optionLabel
          ? String(oldValue.optionLabel)
          : newValue?.optionLabel
            ? String(newValue.optionLabel)
            : undefined,
        category: "options",
      };
    default:
      return null;
  }
}

export async function listDealActivity(dealId: string): Promise<DealActivityItem[]> {
  const documentIds = (
    await prisma.document.findMany({
      where: { dealId },
      select: { id: true },
    })
  ).map((document) => document.id);

  const [stageHistory, auditLogs] = await Promise.all([
    listStageHistory(dealId),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: "Deal", entityId: dealId },
          { newValue: { path: ["dealId"], equals: dealId } },
          { oldValue: { path: ["dealId"], equals: dealId } },
          ...(documentIds.length > 0
            ? [{ entity: "Document", entityId: { in: documentIds } }]
            : []),
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const items: DealActivityItem[] = [
    ...stageHistory.map(formatStageHistory),
    ...auditLogs
      .map(formatAuditLog)
      .filter((item): item is DealActivityItem => item !== null),
  ];

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return items;
}
