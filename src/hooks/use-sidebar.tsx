"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "autocrm-sidebar-open";
const MOBILE_QUERY = "(max-width: 767px)";

interface SidebarContextValue {
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function readStoredOpen(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);

    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setIsOpen(mobile ? false : readStoredOpen());
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!window.matchMedia(MOBILE_QUERY).matches) {
        localStorage.setItem(STORAGE_KEY, String(open));
      }
    },
    [],
  );

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (!window.matchMedia(MOBILE_QUERY).matches) {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const value = useMemo(
    () => ({ isOpen, isMobile, toggle, close }),
    [isOpen, isMobile, toggle, close],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
