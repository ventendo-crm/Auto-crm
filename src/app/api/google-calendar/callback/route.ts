import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { completeGoogleCalendarConnect } from "@/lib/services/google-calendar-settings";
import { getAppPublicUrl } from "@/lib/telegram/bot";
import { verifyGoogleOAuthState } from "@/lib/google-calendar/oauth";

function settingsRedirect(query: Record<string, string>) {
  const url = new URL("/settings", `${getAppPublicUrl()}/`);
  url.searchParams.set("tab", "calendar");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export const GET = withPublic(async (request) => {
  const incoming = new URL(request.url);
  const oauthError = incoming.searchParams.get("error");
  if (oauthError) {
    return settingsRedirect({
      google: "error",
      message: oauthError === "access_denied" ? "Доступ к Google Календарю отклонён" : oauthError,
    });
  }

  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  if (!code || !state) {
    return settingsRedirect({ google: "error", message: "Нет кода авторизации Google" });
  }

  const payload = await verifyGoogleOAuthState(state);
  if (!payload) {
    return settingsRedirect({
      google: "error",
      message: "Сессия подключения Google устарела. Начните заново.",
    });
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, companyId: payload.companyId },
    include: { role: true },
  });
  if (!user || user.role.name !== ROLES.ADMIN) {
    return settingsRedirect({ google: "error", message: "Подключать календарь может только администратор" });
  }

  try {
    await completeGoogleCalendarConnect({
      companyId: payload.companyId,
      userId: payload.userId,
      code,
      state,
    });
    return settingsRedirect({ google: "ok" });
  } catch (err) {
    return settingsRedirect({
      google: "error",
      message: err instanceof Error ? err.message : "Не удалось подключить Google Календарь",
    });
  }
});
