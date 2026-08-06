"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return (
    <>
      <Header title="Настройки" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Tabs defaultValue="profile" className="max-w-5xl">
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-0.5 p-1 sm:min-w-0">
              <TabsTrigger value="profile">Профиль</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
              {isAdmin && <TabsTrigger value="appearance">Оформление</TabsTrigger>}
              {canManageManagersTab && <TabsTrigger value="managers">Менеджеры</TabsTrigger>}
              {isAdmin && <TabsTrigger value="users">Пользователи</TabsTrigger>}
              {isAdmin && <TabsTrigger value="email">Письма</TabsTrigger>}
              {isAdmin && <TabsTrigger value="telegram">Telegram</TabsTrigger>}
              {isAdmin && <TabsTrigger value="calculator">Калькулятор</TabsTrigger>}
              {isPlatformAdmin && <TabsTrigger value="companies">Компании</TabsTrigger>}
            </TabsList>
          </div>

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
