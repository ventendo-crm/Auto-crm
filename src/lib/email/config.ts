export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return Boolean(host && user && from);
}

export function getAppUrl(): string {
  const url = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) {
    return "https://importcrm.ru";
  }
  return url.replace(/\/$/, "");
}

export function getEmailFrom(): { address: string; name: string } {
  const address = process.env.EMAIL_FROM?.trim() || "notifications@importcrm.ru";
  const name = process.env.EMAIL_FROM_NAME?.trim() || "ImportCRM";
  return { address, name };
}
