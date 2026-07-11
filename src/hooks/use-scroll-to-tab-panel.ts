"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";

export function useScrollToTabPanel(activeTab: string, panelId = "tab-panel-content") {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    requestAnimationFrame(() => {
      document.getElementById(panelId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [activeTab, isMobile, panelId]);
}
