"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { getClientRoleName, getDefaultRouteForRole, ROLES } from "@/lib/permissions";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    const role = getClientRoleName(user);
    const isClientSettings = pathname === "/settings" || pathname.startsWith("/settings/");
    if (!loading && user && role === ROLES.CLIENT && !isClientSettings) {
      router.replace(getDefaultRouteForRole(ROLES.CLIENT));
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const role = getClientRoleName(user);
  const isClientSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  if (role === ROLES.CLIENT && !isClientSettings) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </SidebarProvider>
  );
}
