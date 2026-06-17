"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { SearchProcessLinks } from "@/lib/types";

const LINK_FIELDS = [
  {
    key: "inspectionLink" as const,
    label: "Отчет о проверке авто",
    placeholder: "https://example.com/inspection",
  },
  {
    key: "chinaAutotecaLink" as const,
    label: "Ссылка китайской автотеки",
    placeholder: "https://example.com/autoteca",
  },
];

interface SearchProcessLinksPanelProps {
  dealId: string;
  links: SearchProcessLinks;
  canEdit?: boolean;
  onChanged?: () => void;
  onLinksUpdated?: (links: SearchProcessLinks) => void;
}

export function SearchProcessLinksPanel({
  dealId,
  links,
  canEdit = false,
  onChanged,
  onLinksUpdated,
}: SearchProcessLinksPanelProps) {
  const [values, setValues] = useState({
    inspectionLink: links.inspectionLink ?? "",
    chinaAutotecaLink: links.chinaAutotecaLink ?? "",
  });
  const [savingKey, setSavingKey] = useState<keyof SearchProcessLinks | null>(null);

  useEffect(() => {
    setValues({
      inspectionLink: links.inspectionLink ?? "",
      chinaAutotecaLink: links.chinaAutotecaLink ?? "",
    });
  }, [links.chinaAutotecaLink, links.inspectionLink]);

  const saveField = async (key: keyof SearchProcessLinks) => {
    const nextValue = values[key].trim();
    const currentValue = links[key] ?? "";

    if (nextValue === currentValue) return;

    setSavingKey(key);
    try {
      const updated = await api.searchProcess.updateLinks(dealId, {
        [key]: nextValue || null,
      });
      onLinksUpdated?.(updated);
      onChanged?.();
      setValues((current) => ({
        ...current,
        [key]: updated[key] ?? "",
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить ссылку");
      setValues((current) => ({
        ...current,
        [key]: links[key] ?? "",
      }));
    } finally {
      setSavingKey(null);
    }
  };

  if (!canEdit) {
    const visibleFields = LINK_FIELDS.filter((field) => links[field.key]);

    if (visibleFields.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        {visibleFields.map((field) => {
          const href = links[field.key];
          if (!href) return null;

          return (
            <div key={field.key} className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-start gap-1.5 break-all text-sm font-medium text-primary hover:underline"
              >
                <span>{href}</span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              </a>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-background/60 p-4">
      <p className="text-sm font-medium">Ссылки</p>
      {LINK_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`search-link-${field.key}`} className="text-xs">
            {field.label}
          </Label>
          <div className="relative">
            <Input
              id={`search-link-${field.key}`}
              type="url"
              value={values[field.key]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              onBlur={() => void saveField(field.key)}
              placeholder={field.placeholder}
              disabled={savingKey === field.key}
            />
            {savingKey === field.key && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
