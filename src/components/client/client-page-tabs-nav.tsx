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
import { useAuth } from "@/hooks/use-auth";
import { useDealCommentsUnread } from "@/hooks/use-deal-comments-unread";
import { countUploadedDealDocuments } from "@/lib/deal-tab-badges";
import { ClientPortalDeal } from "@/lib/types";

interface ClientPageTabsNavProps {
  deal: ClientPortalDeal;
  activeTab: string;
}

export function ClientPageTabsNav({ deal, activeTab }: ClientPageTabsNavProps) {
  const { user } = useAuth();
  const unreadComments = useDealCommentsUnread(
    deal.id,
    user?.id,
    deal.comments,
    activeTab === "comments",
  );

  const groups = useMemo(() => {
    const uploadedDocuments = countUploadedDealDocuments(deal.documents);

    const mainGroup: GroupedTabGroup = {
      label: "Основное",
      items: [
        {
          value: "documents",
          label: "Документы",
          icon: FileText,
          badge: uploadedDocuments > 0 ? uploadedDocuments : undefined,
        },
        { value: "additional-options", label: "Доп. опции", icon: ListChecks },
      ],
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
  }, [deal, unreadComments]);

  return <GroupedTabsNav groups={groups} />;
}
