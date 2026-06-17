"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/hooks/use-auth";
import { getClientRoleName, getDefaultRouteForRole } from "@/lib/permissions";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const role = getClientRoleName(user);
      router.replace(role ? getDefaultRouteForRole(role) : "/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) return null;

  return <LoginForm />;
}
