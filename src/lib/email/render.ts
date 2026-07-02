function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTemplateString(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildHtmlFromText(
  title: string,
  text: string,
  ctaLabel?: string,
  ctaPath?: string,
): string {
  const paragraphs = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1]?.length > 0));

  const body = paragraphs
    .map((line) =>
      line.length > 0
        ? `<p style="margin:0 0 12px;line-height:1.5;color:#1f2937;">${escapeHtml(line)}</p>`
        : "",
    )
    .join("");

  const cta =
    ctaLabel && ctaPath
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaPath)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">${escapeHtml(title)}</p>
    ${body}
    ${cta}
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">ImportCRM — уведомление отправлено автоматически.</p>
  </div>
</body>
</html>`;
}
