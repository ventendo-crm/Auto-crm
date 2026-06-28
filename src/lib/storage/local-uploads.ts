import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

export function localUploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

export function isLocalUploadUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("/api/uploads/");
}

export function localUploadFilePath(fileUrl: string): string {
  const fileName = path.basename(fileUrl);
  return path.join(localUploadsDir(), fileName);
}

export function displayStoredFileName(storedName: string): string {
  const decoded = decodeURIComponent(storedName);
  const mediaMatch = decoded.match(/^media-[^-]+-[^-]+-\d+-(.+)$/);
  if (mediaMatch) return mediaMatch[1];
  const match = decoded.match(/^\d+-(.+)$/);
  return match?.[1] ?? decoded;
}

export function guessUploadContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export function uploadContentDisposition(fileName: string, download: boolean): string {
  const type = download ? "attachment" : "inline";
  const encoded = encodeURIComponent(fileName);
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_") || "file";
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function openLocalUploadFile(fileUrl: string, displayName?: string): Promise<{
  stream: ReadableStream;
  contentType: string;
  fileName: string;
  size: number;
}> {
  const filePath = localUploadFilePath(fileUrl);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new Error("Not found");
  }

  const storedName = path.basename(fileUrl);
  const fileName = displayName ?? displayStoredFileName(storedName);
  const nodeStream = createReadStream(filePath);

  return {
    stream: Readable.toWeb(nodeStream) as ReadableStream,
    contentType: guessUploadContentType(fileName),
    fileName,
    size: fileStat.size,
  };
}
