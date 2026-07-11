"use client";

import {
  ClipboardList,
  FileText,
  History,
  ImageIcon,
  ListChecks,
  MessageSquare,
  Receipt,
  Search,
  Truck,
} from "lucide-react";
import { useMemo } from "react";
import { GroupedTabGroup, GroupedTabsNav } from "@/components/ui/grouped-tabs-nav";
import { CLIENT_DOCUMENT_ORDER } from "@/lib/constants";
import { DealDetail } from "@/lib/types";

interface DealPageTabsNavProps {
  deal: DealDetail;
  canViewExpenses: boolean;
}

export function DealPageTabsNav({ deal, canViewExpenses }: DealPageTabsNavProps) {
  const groups = useMemo(() => {
    const missingDocuments = CLIENT_DOCUMENT_ORDER.filter((type) => {
      const doc = deal.documents.find((item) => item.type === type);
      return !doc || doc.status === "MISSING";
    }).length;

    const mainItems: GroupedTabGroup["items"] = [
      { value: "overview", label: "Обзор", icon: ClipboardList },
      {
        value: "documents",
        label: "Документы",
        icon: FileText,
        badge: missingDocuments > 0 ? missingDocuments : undefined,
      },
      {
        value: "comments",
        label: "Комментарии",
        icon: MessageSquare,
        badge: deal.comments.length > 0 ? deal.comments.length : undefined,
      },
      { value: "additional-options", label: "Доп. опции", icon: ListChecks },
    ];

    if (canViewExpenses) {
      mainItems.push({ value: "expenses", label: "Расходы", icon: Receipt });
    }

    const mainGroup: GroupedTabGroup = {
      label: "Основное",
      items: mainItems,
    };

    const processItems: GroupedTabGroup["items"] = [
      { value: "search-process", label: "Поиск авто", icon: Search },
    ];

    if (deal.importProcessEnabled) {
      processItems.push({ value: "import-process", label: "Импорт авто", icon: Truck });
    }

    const processGroup: GroupedTabGroup = {
      label: "Процесс",
      items: processItems,
    };

    const moreGroup: GroupedTabGroup = {
      label: "Прочее",
      items: [
        { value: "history", label: "История", icon: History },
        {
          value: "media",
          label: "Медиа",
          icon: ImageIcon,
          badge: deal.media?.length ? deal.media.length : undefined,
        },
      ],
    };

    return [mainGroup, processGroup, moreGroup];
  }, [canViewExpenses, deal]);

  return <GroupedTabsNav groups={groups} />;
}
