"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Building2,
  Calculator,
  CalendarDays,
  Mail,
  MessageCircle,
  Palette,
  SlidersHorizontal,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppearancePanel } from "@/components/settings/appearance-panel";
import { CalculatorExpensesPanel } from "@/components/settings/calculator-expenses-panel";
import { CompaniesPanel } from "@/components/settings/companies-panel";
import { CompanyWorkspacePanel } from "@/components/settings/company-workspace-panel";
import { EmailTemplatesPanel } from "@/components/settings/email-templates-panel";
import { GoogleCalendarSettingsCard } from "@/components/settings/google-calendar-settings-card";
import { TelegramBotSettingsCard } from "@/components/settings/telegram-bot-settings-card";
import { TelegramTemplatesPanel } from "@/components/settings/telegram-templates-panel";
import { Header } from "@/components/layout/header";
import { ManagersPanel } from "@/components/settings/managers-panel";
import { UsersPanel } from "@/components/settings/users-panel";
import { NotificationsPanel } from "@/components/settings/notifications-panel";
import { ProfilePanel } from "@/components/settings/profile-panel";
import { GroupedTabGroup, GroupedTabsNav } from "@/components/ui/grouped-tabs-nav";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { getClientRoleName } from "@/lib/permissions";

const SETTINGS_TABS = new Set([
  "profile",
  "notifications",
  "appearance",
  "workspace",
  "managers",
  "users",
  "email",
  "telegram",
  "calendar",
  "calculator",
  "companies",
]);

export function SettingsView() {
  return (
    <Suspense>
      <SettingsViewInner />
    </Suspense>
  );
}

function SettingsViewInner() {
  const { user } = useAuth();
  const { settings } = useCompanyWorkspace();
  const role = getClientRoleName(user);
  const isAdmin = role === "ADMIN";
  const isClient = role === "CLIENT";
  const canManageManagersTab = role === "ADMIN" || role === "MANAGER";
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const subtitle = isPlatformAdmin
    ? "Профиль, компании, письма, Telegram, календарь, калькулятор и пользователи"
    : isAdmin
      ? "Профиль, компания, оформление, уведомления, письма, Telegram, календарь, калькулятор и пользователи"
      : canManageManagersTab
        ? "Профиль, уведомления и менеджеры"
        : isClient
          ? "Профиль, пароль и уведомления"
          : "Профиль и уведомления";

  const groups = useMemo(() => {
    const accountGroup: GroupedTabGroup = {
      label: "Аккаунт",
      items: [
        { value: "profile", label: "Профиль", icon: User },
        { value: "notifications", label: "Уведомления", icon: Bell },
      ],
    };

    const peopleItems: GroupedTabGroup["items"] = [];
    if (canManageManagersTab) {
      peopleItems.push({ value: "managers", label: "Менеджеры", icon: Users });
    }
    if (isAdmin) {
      peopleItems.push({ value: "users", label: "Пользователи", icon: UserCog });
    }

    const companyItems: GroupedTabGroup["items"] = [];
    if (isAdmin) {
      companyItems.push(
        { value: "workspace", label: "Компания", icon: SlidersHorizontal },
        { value: "appearance", label: "Оформление", icon: Palette },
        { value: "email", label: "Письма", icon: Mail },
        { value: "telegram", label: "Telegram", icon: MessageCircle },
      );
      if (settings.modules.googleCalendar) {
        companyItems.push({ value: "calendar", label: "Календарь", icon: CalendarDays });
      }
      if (settings.modules.calculator) {
        companyItems.push({ value: "calculator", label: "Калькулятор", icon: Calculator });
      }
    }

    const result: GroupedTabGroup[] = [accountGroup];
    if (peopleItems.length > 0) {
      result.push({ label: "Сотрудники", items: peopleItems });
    }
    if (companyItems.length > 0) {
      result.push({ label: "Компания", items: companyItems });
    }
    if (isPlatformAdmin) {
      result.push({
        label: "Платформа",
        items: [{ value: "companies", label: "Компании", icon: Building2 }],
      });
    }

    return result;
  }, [canManageManagersTab, isAdmin, isPlatformAdmin, settings.modules.calculator, settings.modules.googleCalendar]);

  const allowedTabs = useMemo(
    () => new Set(groups.flatMap((group) => group.items.map((item) => item.value))),
    [groups],
  );

  const requestedTab = searchParams.get("tab");
  const initialTab =
    requestedTab && SETTINGS_TABS.has(requestedTab) && allowedTabs.has(requestedTab)
      ? requestedTab
      : "profile";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (allowedTabs.has(initialTab) && initialTab !== tab) {
      setTab(initialTab);
    }
  }, [allowedTabs, initialTab, tab]);

  useEffect(() => {
    const google = searchParams.get("google");
    if (!google) return;

    if (google === "ok") {
      toast.success("Google Календарь подключён. События выгружаются в фоне.");
    } else if (google === "error") {
      toast.error(searchParams.get("message") || "Не удалось подключить Google Календарь");
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("google");
    next.delete("message");
    next.set("tab", "calendar");
    router.replace(`${pathname}?${next.toString()}`);
  }, [pathname, router, searchParams]);

  const handleTabChange = (value: string) => {
    setTab(value);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", value);
    next.delete("google");
    next.delete("message");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      <Header title="Настройки" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Tabs value={tab} onValueChange={handleTabChange} className="max-w-5xl">
          <GroupedTabsNav groups={groups} wrap />

          <TabsContent value="profile" className="mt-4">
            <ProfilePanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <NotificationsPanel />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="workspace" className="mt-4">
              <CompanyWorkspacePanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="appearance" className="mt-4">
              <AppearancePanel />
            </TabsContent>
          )}

          {canManageManagersTab && (
            <TabsContent value="managers" className="mt-4">
              <ManagersPanel canDeleteUsers={isAdmin} showOtherUsers={isAdmin} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="users" className="mt-4">
              <UsersPanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="email" className="mt-4">
              <EmailTemplatesPanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="telegram" className="mt-4 space-y-4">
              <TelegramBotSettingsCard />
              <TelegramTemplatesPanel />
            </TabsContent>
          )}

          {isAdmin && settings.modules.googleCalendar && (
            <TabsContent value="calendar" className="mt-4">
              <GoogleCalendarSettingsCard />
            </TabsContent>
          )}

          {isAdmin && settings.modules.calculator && (
            <TabsContent value="calculator" className="mt-4">
              <CalculatorExpensesPanel />
            </TabsContent>
          )}

          {isPlatformAdmin && (
            <TabsContent value="companies" className="mt-4">
              <CompaniesPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
