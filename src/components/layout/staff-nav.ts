import {
  Calculator,
  Kanban,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type StaffNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  calculatorOnly?: boolean;
};

export const staffPrimaryNavItems: StaffNavItem[] = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/kanban", label: "Канбан", icon: Kanban },
  {
    href: "/calculator",
    label: "Калькулятор",
    shortLabel: "Кальк.",
    icon: Calculator,
    calculatorOnly: true,
  },
];

export const staffSidebarNavItems: StaffNavItem[] = [
  ...staffPrimaryNavItems,
  { href: "/settings", label: "Настройки", icon: Settings },
];

/** Высота нижнего bar на мобилке (h-14) + safe area — для sticky-элементов над bar. */
export const MOBILE_TAB_BAR_OFFSET_CLASS =
  "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]";

export const MOBILE_TAB_BAR_PADDING_CLASS =
  "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]";
