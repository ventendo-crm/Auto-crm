"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { useAuth } from "@/hooks/use-auth";
import { getClientRoleName, getDefaultRouteForRole } from "@/lib/permissions";

export default function ForgotPasswordPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const role = getClientRoleName(user);
      router.replace(role ? getDefaultRouteForRole(role) : "/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) return null;

  return <ForgotPasswordForm />;
}
