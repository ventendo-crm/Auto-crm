"use client";

import {
  FileText,
  History,
  ImageIcon,
  ListChecks,
  MessageSquare,
  Package,
  Search,
  Truck,
} from "lucide-react";
import { useMemo } from "react";
import { GroupedTabGroup, GroupedTabsNav } from "@/components/ui/grouped-tabs-nav";
import { CLIENT_DOCUMENT_ORDER } from "@/lib/constants";
import { ClientPortalDeal } from "@/lib/types";

interface ClientPageTabsNavProps {
  deal: ClientPortalDeal;
}

export function ClientPageTabsNav({ deal }: ClientPageTabsNavProps) {
  const groups = useMemo(() => {
    const missingDocuments = CLIENT_DOCUMENT_ORDER.filter((type) => {
      const doc = deal.documents.find((item) => item.type === type);
      return !doc || doc.status === "MISSING";
    }).length;

    const mainGroup: GroupedTabGroup = {
      label: "Основное",
      items: [
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
      ],
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
        {
          value: "media",
          label: "Медиа",
          icon: ImageIcon,
          badge: deal.media.length > 0 ? deal.media.length : undefined,
        },
        { value: "history", label: "История", icon: History },
        { value: "logistics", label: "Логистика", icon: Package },
      ],
    };

    return [mainGroup, processGroup, moreGroup];
  }, [deal]);

  return <GroupedTabsNav groups={groups} />;
}
