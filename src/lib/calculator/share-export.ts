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
  description: string;
  sourceUrl: string;
  totalLabel?: string | null;
}) {
  const parts: string[] = [];
  const description = input.description.trim();
  const sourceUrl = input.sourceUrl.trim();
  if (description) parts.push(description);
  if (sourceUrl) parts.push(sourceUrl);
  if (input.totalLabel) parts.push(`Итого: ${input.totalLabel}`);
  return parts.join("\n\n");
}

export async function shareOfferPackage(input: {
  title?: string;
  text: string;
  files: File[];
}) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    throw new Error("SHARE_UNAVAILABLE");
  }

  const payload: ShareData = {
    title: input.title ?? "Авто из ImportCRM",
    text: input.text || undefined,
    files: input.files.length > 0 ? input.files : undefined,
  };

  if (typeof navigator.canShare === "function") {
    if (payload.files && !navigator.canShare(payload)) {
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
