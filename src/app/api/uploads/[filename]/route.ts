import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

function displayFileName(fileName: string): string {
  const decoded = decodeURIComponent(fileName);
  const mediaMatch = decoded.match(/^media-[^-]+-[^-]+-\d+-(.+)$/);
  if (mediaMatch) return mediaMatch[1];
  const match = decoded.match(/^\d+-(.+)$/);
  return match?.[1] ?? decoded;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), "uploads", safeName);

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const download = new URL(request.url).searchParams.get("download") === "1";
    const label = displayFileName(safeName);

    let contentType = "application/octet-stream";

    switch (ext) {
      case ".pdf":
        contentType = "application/pdf";
        break;
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".mp4":
        contentType = "video/mp4";
        break;
      case ".webm":
        contentType = "video/webm";
        break;
      case ".mov":
        contentType = "video/quicktime";
        break;
      case ".doc":
        contentType = "application/msword";
        break;
      case ".docx":
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${label}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Файл не найден",
      },
      { status: 404 },
    );
  }
}