"use client";

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

  const subtitle = isAdmin
    ? "Профиль, уведомления и пользователи"
    : canManageManagersTab
      ? "Профиль, уведомления и менеджеры"
      : isClient
        ? "Профиль, пароль и уведомления"
        : "Профиль и уведомления";

  return (
    <>
      <Header title="Настройки" subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Tabs defaultValue="profile" className="max-w-3xl">
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-0.5 p-1 sm:min-w-0">
              <TabsTrigger value="profile">Профиль</TabsTrigger>
              <TabsTrigger value="notifications">Уведомления</TabsTrigger>
              {canManageManagersTab && <TabsTrigger value="managers">Менеджеры</TabsTrigger>}
              {isAdmin && <TabsTrigger value="users">Пользователи</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="profile" className="mt-4">
            <ProfilePanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <NotificationsPanel />
          </TabsContent>

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
        </Tabs>
      </div>
    </>
  );
}
