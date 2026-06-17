import { z } from "zod";

const linkField = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (!value) return null;
    return value;
  });

export const updateSearchProcessLinksSchema = z.object({
  inspectionLink: linkField,
  chinaAutotecaLink: linkField,
});

export function normalizeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
