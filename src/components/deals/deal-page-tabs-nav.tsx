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
import { useAuth } from "@/hooks/use-auth";
import { useDealCommentsUnread } from "@/hooks/use-deal-comments-unread";
import { countUploadedDealDocuments } from "@/lib/deal-tab-badges";
import { DealDetail } from "@/lib/types";

interface DealPageTabsNavProps {
  deal: DealDetail;
  canViewExpenses: boolean;
  activeTab: string;
}

export function DealPageTabsNav({ deal, canViewExpenses, activeTab }: DealPageTabsNavProps) {
  const { user } = useAuth();
  const unreadComments = useDealCommentsUnread(
    deal.id,
    user?.id,
    deal.comments,
    activeTab === "comments",
  );

  const groups = useMemo(() => {
    const uploadedDocuments = countUploadedDealDocuments(deal.documents);

    const mainItems: GroupedTabGroup["items"] = [
      { value: "overview", label: "Обзор", icon: ClipboardList },
      {
        value: "documents",
        label: "Документы",
        icon: FileText,
        badge: uploadedDocuments > 0 ? uploadedDocuments : undefined,
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
      processItems.push({ value: "import-process", label: "Доставка", icon: Truck });
    }

    const processGroup: GroupedTabGroup = {
      label: "Процесс",
      items: processItems,
    };

    const moreGroup: GroupedTabGroup = {
      label: "Прочее",
      items: [
        {
          value: "comments",
          label: "Комментарии",
          icon: MessageSquare,
          badge: unreadComments > 0 ? unreadComments : undefined,
        },
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
  }, [canViewExpenses, deal, unreadComments]);

  return <GroupedTabsNav groups={groups} />;
}
