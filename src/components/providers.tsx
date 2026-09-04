"use client";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { CompanyAppearanceProvider } from "@/hooks/use-company-appearance";
import { CompanyWorkspaceProvider } from "@/hooks/use-company-workspace";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster richColors closeButton position="top-right" theme={theme} duration={4000} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompanyAppearanceProvider>
          <CompanyWorkspaceProvider>
            {children}
            <ThemedToaster />
          </CompanyWorkspaceProvider>
        </CompanyAppearanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
