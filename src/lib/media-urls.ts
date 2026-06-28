export function getMediaDownloadUrl(mediaId: string): string {
  return `/api/media/${mediaId}/file?download=1`;
}
