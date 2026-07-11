"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsiblePanel({ open, children, className }: CollapsiblePanelProps) {
  return (
    <div className="collapsible-panel" data-open={open} aria-hidden={!open}>
      <div className={cn("overflow-hidden", className)}>{children}</div>
    </div>
  );
}

interface CollapsibleTriggerProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function CollapsibleTrigger({
  open,
  onToggle,
  children,
  className,
}: CollapsibleTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn("flex w-full min-w-0 items-center gap-2 text-left", className)}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-normal",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}
