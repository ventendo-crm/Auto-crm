"use client";

import {
  Calculator,
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
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";

interface ClientPageTabsNavProps {
  deal: ClientPortalDeal;
  activeTab: string;
}

export function ClientPageTabsNav({ deal, activeTab }: ClientPageTabsNavProps) {
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const unreadComments = useDealCommentsUnread(
    deal.id,
    user?.id,
    deal.comments,
    activeTab === "comments",
  );

  const groups = useMemo(() => {
    const uploadedDocuments = countUploadedDealDocuments(deal.documents);

    const mainItems: GroupedTabGroup["items"] = [
      {
        value: "documents",
        label: "Документы",
        icon: FileText,
        badge: uploadedDocuments > 0 ? uploadedDocuments : undefined,
      },
    ];
    if (settings.modules.calculator) {
      mainItems.push({ value: "customs-estimate", label: "Расчёт", icon: Calculator });
    }
    if (settings.dealTabs.additionalOptions) {
      mainItems.push({ value: "additional-options", label: "Доп. опции", icon: ListChecks });
    }

    const mainGroup: GroupedTabGroup = {
      label: "Основное",
      items: mainItems,
    };

    const processItems: GroupedTabGroup["items"] = [];
    if (settings.dealTabs.searchProcess) {
      processItems.push({ value: "search-process", label: "Поиск авто", icon: Search });
    }

    if (settings.dealTabs.importProcess && deal.importProcessEnabled) {
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
      ],
    };
    if (settings.dealTabs.logistics) {
      moreGroup.items.push({ value: "logistics", label: "Логистика", icon: Package });
    }

    const result: GroupedTabGroup[] = [mainGroup];
    if (processItems.length > 0) {
      result.push(processGroup);
    }
    result.push(moreGroup);
    return result;
  }, [deal, unreadComments, settings.dealTabs, settings.modules.calculator]);

  return <GroupedTabsNav groups={groups} />;
}
