import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const me = await tg("getMe");
console.log("Bot:", me.ok ? `@${me.result.username}` : me.description);

const webhook = await tg("getWebhookInfo");
console.log("Webhook URL:", webhook.result?.url || "(not set)");
if (webhook.result?.last_error_message) {
  console.log("Webhook error:", webhook.result.last_error_message);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  select: { email: true, name: true, telegramChatId: true },
  orderBy: { email: "asc" },
});

console.log("\nUsers in DB:");
for (const u of users) {
  console.log(`  ${u.email} | chatId=${u.telegramChatId ?? "—"}`);
}

const defaultChatId = process.env.TELEGRAM_CHAT_ID?.trim();
console.log("\nTELEGRAM_CHAT_ID env:", defaultChatId || "(empty)");

await prisma.$disconnect();
