export function downloadBlob(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function exportFilename(extension: "pdf" | "jpg") {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `rastamozhka-${stamp}.${extension}`;
}

export async function captureResultCanvas(element: HTMLElement, scale = 2) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (_doc, cloned) => {
      cloned.style.backgroundColor = "#ffffff";
      cloned.style.color = "#1f2937";
      cloned.style.fontFamily = "Arial, Helvetica, sans-serif";
      cloned.style.letterSpacing = "0";
      cloned.style.wordSpacing = "0";
      cloned.querySelectorAll<HTMLElement>("*").forEach((node) => {
        node.style.letterSpacing = "0";
        node.style.wordSpacing = "normal";
        node.style.fontVariantNumeric = "tabular-nums";
        node.style.fontFamily = "Arial, Helvetica, sans-serif";
      });
    },
  });
}

export async function canvasToJpegFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Не удалось подготовить изображение"));
      },
      "image/jpeg",
      1,
    );
  });
  return new File([blob], filename, { type: "image/jpeg" });
}

export async function captureResultJpegFile(element: HTMLElement): Promise<File> {
  const canvas = await captureResultCanvas(element, 5);
  return canvasToJpegFile(canvas, exportFilename("jpg"));
}

export async function saveResultAsJpeg(element: HTMLElement) {
  const canvas = await captureResultCanvas(element, 5);
  downloadBlob(exportFilename("jpg"), canvas.toDataURL("image/jpeg", 1));
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare !== "function") {
    return true;
  }
  try {
    return navigator.canShare({
      files: [new File(["x"], "probe.jpg", { type: "image/jpeg" })],
    });
  } catch {
    return false;
  }
}

/** Windows/Chrome на ПК тоже умеет share files — там нужна ссылка, а не системное меню. */
export function isPhoneFileShare(): boolean {
  if (!canShareFiles()) return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function shareResultAsJpeg(element: HTMLElement) {
  const file = await captureResultJpegFile(element);
  try {
    await shareOfferPackage({
      title: "Расчёт растаможки",
      text: "Расчёт растаможки из ImportCRM",
      files: [file],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SHARE_UNAVAILABLE") {
      throw new Error("На этом устройстве шаринг недоступен");
    }
    throw error;
  }
}

export async function saveResultAsPdf(element: HTMLElement) {
  const canvas = await captureResultCanvas(element, 4);
  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  let imgWidth = usableWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;
  if (imgHeight > usableHeight) {
    const scale = usableHeight / imgHeight;
    imgWidth *= scale;
    imgHeight = usableHeight;
  }

  const x = margin + (usableWidth - imgWidth) / 2;
  const y = margin + (usableHeight - imgHeight) / 2;
  pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
  pdf.save(exportFilename("pdf"));
}

export function buildOfferShareText(input: {
  vehicleTitle?: string;
  description: string;
  sourceUrl: string;
  totalLabel?: string | null;
}) {
  const parts: string[] = [];
  const vehicleTitle = input.vehicleTitle?.trim() ?? "";
  const description = input.description.trim();
  const sourceUrl = input.sourceUrl.trim();
  if (vehicleTitle) parts.push(vehicleTitle);
  if (description) parts.push(description);
  if (sourceUrl) parts.push(sourceUrl);
  if (input.totalLabel) parts.push(`Итого: ${input.totalLabel}`);
  return parts.join("\n\n");
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];

  const pushWord = (word: string, current: string): string => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) return next;
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) return word;

    let chunk = "";
    for (const char of word) {
      const trial = chunk + char;
      if (ctx.measureText(trial).width <= maxWidth) {
        chunk = trial;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    return chunk;
  };

  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      current = pushWord(word, current);
    }
    if (current) lines.push(current);
  }

  return lines;
}

/** Telegram/Max на телефоне выкидывают text, если есть файлы — текст уходит картинкой. */
export async function offerTextToJpegFile(text: string): Promise<File> {
  const width = 1080;
  const padding = 56;
  const fontSize = 36;
  const lineHeight = 50;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Не удалось подготовить текст");
  }

  const font = `400 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.font = font;
  const lines = wrapCanvasLines(ctx, text.trim(), width - padding * 2);
  canvas.width = width;
  canvas.height = Math.min(8000, padding * 2 + Math.max(1, lines.length) * lineHeight);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1f2937";
  ctx.font = font;
  ctx.textBaseline = "top";

  let y = padding;
  const maxY = canvas.height - padding;
  for (const line of lines) {
    if (y + lineHeight > maxY + 8) break;
    ctx.fillText(line, padding, y);
    y += lineHeight;
  }

  return canvasToJpegFile(canvas, "opisanie.jpg");
}

export async function shareOfferPackage(input: {
  title?: string;
  text: string;
  files: File[];
}) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    throw new Error("SHARE_UNAVAILABLE");
  }

  const files = [...input.files];
  const text = input.text.trim();
  if (text && files.length > 0) {
    files.unshift(await offerTextToJpegFile(text));
  }

  const payload: ShareData = {
    title: text || input.title || "Авто из ImportCRM",
    text: text || undefined,
    files: files.length > 0 ? files : undefined,
  };

  if (typeof navigator.canShare === "function") {
    if (payload.files && !navigator.canShare(payload)) {
      const filesWithText: ShareData = { text: payload.text, files: payload.files };
      if (payload.text && navigator.canShare(filesWithText)) {
        await navigator.share(filesWithText);
        return;
      }
      const originalFiles = input.files.length > 0 ? input.files : undefined;
      const originalWithText: ShareData = { title: payload.title, text: payload.text, files: originalFiles };
      if (originalFiles && payload.text && navigator.canShare(originalWithText)) {
        await navigator.share(originalWithText);
        return;
      }
      const filesOnly: ShareData = { files: originalFiles ?? payload.files };
      if (filesOnly.files && navigator.canShare(filesOnly)) {
        await navigator.share(filesOnly);
        return;
      }
      const withoutFiles: ShareData = { title: payload.title, text: payload.text };
      if (navigator.canShare(withoutFiles) && payload.text) {
        await navigator.share(withoutFiles);
        throw new Error("SHARE_TEXT_ONLY");
      }
      throw new Error("SHARE_FILES_UNSUPPORTED");
    }
  }

  await navigator.share(payload);
}
