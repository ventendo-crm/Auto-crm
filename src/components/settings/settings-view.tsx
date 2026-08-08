"use client";

import { useMemo } from "react";
import {
  Bell,
  Building2,
  Calculator,
  Mail,
  MessageCircle,
  Palette,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { AppearancePanel } from "@/components/settings/appearance-panel";
import { CalculatorExpensesPanel } from "@/components/settings/calculator-expenses-panel";
import { CompaniesPanel } from "@/components/settings/companies-panel";
import { EmailTemplatesPanel } from "@/components/settings/email-templates-panel";
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
import { getClientRoleName } from "@/lib/permissions";

export function SettingsView() {
  const { user } = useAuth();
  const role = getClientRoleName(user);
  const isAdmin = role === "ADMIN";
  const isClient = role === "CLIENT";
  const canManageManagersTab = role === "ADMIN" || role === "MANAGER";
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);

  const subtitle = isPlatformAdmin
    ? "Профиль, компании, письма, Telegram, калькулятор и пользователи"
    : isAdmin
      ? "Профиль, оформление, уведомления, письма, Telegram, калькулятор и пользователи"
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
        { value: "appearance", label: "Оформление", icon: Palette },
        { value: "email", label: "Письма", icon: Mail },
        { value: "telegram", label: "Telegram", icon: MessageCircle },
        { value: "calculator", label: "Калькулятор", icon: Calculator },
      );
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
  }, [canManageManagersTab, isAdmin, isPlatformAdmin]);

  return (
    <>
      <Header title="Настройки" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Tabs defaultValue="profile" className="max-w-5xl">
          <GroupedTabsNav groups={groups} wrap />

          <TabsContent value="profile" className="mt-4">
            <ProfilePanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <NotificationsPanel />
          </TabsContent>

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

          {isAdmin && (
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
