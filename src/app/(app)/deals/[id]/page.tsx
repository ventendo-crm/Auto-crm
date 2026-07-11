"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { MediaGallery } from "@/components/media/media-gallery";
import { DealActivityTimeline } from "@/components/deals/deal-activity-timeline";
import { DealClientAccount } from "@/components/deals/deal-client-account";
import { DealAdditionalOptions } from "@/components/deals/deal-additional-options";
import { DealComments } from "@/components/deals/deal-comments";
import { DealDocuments, RECEIVED_DEAL_DOCUMENT_TYPES } from "@/components/deals/deal-documents";
import { DealExpenses } from "@/components/deals/deal-expenses";
import { DealFinancialSummaryCard } from "@/components/deals/deal-financial-summary";
import { DealReminders } from "@/components/deals/deal-reminders";
import { DealHeader } from "@/components/deals/deal-header";
import { DealInfo } from "@/components/deals/deal-info";
import { DealImportProcess } from "@/components/deals/deal-import-process";
import { DealImportProcessToggle } from "@/components/deals/deal-import-process-toggle";
import { DealOverviewSummary } from "@/components/deals/deal-overview-summary";
import { DealSearchProcess } from "@/components/deals/deal-search-process";
import { DealLogistics } from "@/components/deals/deal-logistics";
import { DealManagerSelector } from "@/components/deals/deal-manager-selector";
import { DealPageTabsNav } from "@/components/deals/deal-page-tabs-nav";
import { DealStageSelector } from "@/components/deals/deal-stage-selector";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";

import { useAuth } from "@/hooks/use-auth";
import { useScrollToTabPanel } from "@/hooks/use-scroll-to-tab-panel";
import { api } from "@/lib/api-client";
import { canClearDealHistory, canManageDealClient, canManageDealExpenses, canManageDealReminders, canUploadDealDocuments, canViewDealFinances, getClientRoleName } from "@/lib/permissions";
import { DealActivityItem } from "@/lib/services/deal-activity";
import { DealDetail } from "@/lib/types";

export default function DealPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [activity, setActivity] = useState<DealActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useScrollToTabPanel(activeTab);

  const canManageDeal = deal ? canManageDealClient(user, deal) : false;

  const role = getClientRoleName(user);
  const canClearHistory =
    deal && role && user ? canClearDealHistory(role, user.id, deal) : false;
  const canViewExpenses =
    deal && role && user ? canManageDealExpenses(role, user.id, deal) : false;

  const canViewFinances =
    deal && role && user ? canViewDealFinances(role, user.id, deal) : false;

  const canManageReminders =
    deal && role && user ? canManageDealReminders(role, user.id, deal) : false;

  const canUploadDocuments =
    deal && role && user
      ? canUploadDealDocuments(role, user.id, deal)
      : false;

  const canDeleteDeal = canManageDeal;

  const canUploadMedia = canManageDeal;

  const refreshDeal = useCallback(async () => {
    if (!params.id) return;

    try {
      const [data, activityData] = await Promise.all([
        api.deals.get(params.id),
        api.deals.activity(params.id),
      ]);
      setDeal(data);
      setActivity(activityData);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить данные сделки",
      );
    }
  }, [params.id]);

  const refreshActivity = useCallback(async () => {
    if (!params.id) return;

    try {
      const activityData = await api.deals.activity(params.id);
      setActivity(activityData);
    } catch {
      // история не критична для работы карточки
    }
  }, [params.id]);

  const clearActivity = useCallback(async () => {
    if (!params.id) return;

    await api.deals.clearActivity(params.id);
    setActivity([]);
  }, [params.id]);

  const load = useCallback(async () => {
    if (!params.id) return;

    setLoading(true);

    try {
      const [data, activityData] = await Promise.all([
        api.deals.get(params.id),
        api.deals.activity(params.id),
      ]);
      setDeal(data);
      setActivity(activityData);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Сделка не найдена"
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || authLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Сделка не найдена
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DealHeader deal={deal} canDelete={canDeleteDeal} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm text-muted-foreground">Этап:</span>
            <DealStageSelector
              dealId={deal.id}
              currentStage={deal.currentStage}
              managerIds={deal.managerIds}
              onChanged={refreshDeal}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm text-muted-foreground">Менеджеры:</span>
            <DealManagerSelector
              dealId={deal.id}
              managerIds={deal.managerIds}
              managers={deal.managers}
              onChanged={refreshDeal}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <DealPageTabsNav
            deal={deal}
            canViewExpenses={canViewExpenses}
            activeTab={activeTab}
          />

          <div id="tab-panel-content" className="scroll-mt-12" aria-hidden />

          <TabsContent value="overview" className="space-y-4">
            <DealOverviewSummary
              dealId={deal.id}
              carBrand={deal.carBrand}
              carModel={deal.carModel}
              carYear={deal.carYear}
              active={activeTab === "overview"}
            />

            <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <DealInfo
                deal={deal}
                onUpdated={refreshDeal}
                canEdit={canManageDeal}
                canViewFinances={canViewFinances}
              />
              <DealImportProcessToggle
                dealId={deal.id}
                enabled={deal.importProcessEnabled}
                canManage={canManageDeal}
                onChanged={refreshDeal}
              />
            </div>

            <div className="space-y-4">
              {canViewFinances && <DealFinancialSummaryCard deal={deal} />}
              {canManageReminders && <DealReminders dealId={deal.id} canManage />}
              <DealClientAccount
                deal={deal}
                canManage={canManageDeal}
                onUpdated={refreshDeal}
              />
              <DealLogistics
                dealId={deal.id}
                shipment={deal.shipment}
                canEdit={canManageDeal}
                onUpdated={refreshDeal}
              />
            </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DealDocuments
              dealId={deal.id}
              documents={deal.documents}
              managerId={deal.managerId}
              managerIds={deal.managerIds}
              clientUserId={deal.clientUserId}
              onUpdated={refreshDeal}
              canUpload={canUploadDocuments}
              canVerify={canManageDeal}
              canDelete={canManageDeal}
            />
            <DealDocuments
              dealId={deal.id}
              documents={deal.documents}
              managerId={deal.managerId}
              managerIds={deal.managerIds}
              clientUserId={deal.clientUserId}
              title="Полученные документы"
              documentTypes={RECEIVED_DEAL_DOCUMENT_TYPES}
              onUpdated={refreshDeal}
              canUpload={canUploadDocuments}
              canVerify={canManageDeal}
              canDelete={canManageDeal}
            />
          </TabsContent>

          <TabsContent value="search-process">
            <DealSearchProcess
              dealId={deal.id}
              canEdit={canManageDeal}
              onChanged={refreshActivity}
            />
          </TabsContent>

          <TabsContent value="additional-options">
            <DealAdditionalOptions dealId={deal.id} onChanged={refreshActivity} />
          </TabsContent>

          {canViewExpenses && (
            <TabsContent value="expenses">
              <DealExpenses dealId={deal.id} canEdit={canViewExpenses} />
            </TabsContent>
          )}

          {deal.importProcessEnabled && (
            <TabsContent value="import-process">
              <DealImportProcess dealId={deal.id} canEdit={canManageDeal} />
            </TabsContent>
          )}

          <TabsContent value="history">
            <DealActivityTimeline
              activity={activity}
              canClear={canClearHistory}
              onClear={clearActivity}
            />
          </TabsContent>

          <TabsContent value="comments">
            <DealComments
              dealId={deal.id}
              managerId={deal.managerId}
              managerIds={deal.managerIds}
              clientUserId={deal.clientUserId}
              initialComments={deal.comments}
              onUpdate={refreshDeal}
              pollingEnabled={activeTab === "comments"}
            />
          </TabsContent>

          <TabsContent value="media">
            <MediaGallery
              dealId={deal.id}
              initialMedia={deal.media ?? []}
              canUpload={canUploadMedia}
              canDownload
              onUpdate={refreshDeal}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}