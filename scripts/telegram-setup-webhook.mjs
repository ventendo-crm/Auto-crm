import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(relativePath) {
  try {
    const envPath = resolve(process.cwd(), relativePath);
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
  } catch {
    // optional env file
  }
}

loadEnvFile(".env");
loadEnvFile("deploy/.env");

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const webhookUrl = process.argv[2]?.trim();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set (.env or deploy/.env)");
  process.exit(1);
}

if (!webhookUrl) {
  console.error(
    "Usage: node scripts/telegram-setup-webhook.mjs https://importcrm.ru/api/telegram/webhook",
  );
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
console.log("Bot:", me.ok ? `@${me.result.username} (${me.result.first_name})` : me.description);
if (!me.ok) process.exit(1);

const payload = {
  url: webhookUrl,
  allowed_updates: ["message"],
  drop_pending_updates: true,
  ...(webhookSecret ? { secret_token: webhookSecret } : {}),
};

const setWebhook = await tg("setWebhook", payload);
console.log("setWebhook:", setWebhook.ok ? "OK" : setWebhook.description);

const info = await tg("getWebhookInfo");
console.log("Webhook URL:", info.result?.url || "(not set)");
if (info.result?.last_error_message) {
  console.log("Last webhook error:", info.result.last_error_message);
}

const testChatId = process.env.TELEGRAM_CHAT_ID?.trim();
if (testChatId) {
  const send = await tg("sendMessage", {
    chat_id: testChatId,
    text: "Auto-CRM: webhook настроен, тестовое сообщение доставлено.",
  });
  console.log("Test message:", send.ok ? "sent" : send.description);
}
