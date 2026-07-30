import { NextRequest, NextResponse } from "next/server";

/** Legacy webhook without companyId — keep for old env setup, prefer /api/telegram/webhook/[companyId] */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Устаревший webhook. Привяжите бота в Настройки → Telegram — CRM поставит webhook /api/telegram/webhook/<companyId>.",
    },
    { status: 410 },
  );
}
