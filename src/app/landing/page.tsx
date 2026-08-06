import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { LandingPage } from "@/components/landing/landing-page";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-landing-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ImportCRM — CRM для импорта автомобилей",
  description:
    "ImportCRM — CRM для импорта авто: калькулятор для Китая, Кореи и Киргизии с поиском и привязкой к клиенту, кабинет с автовозом. 30 дней бесплатно.",
};

export default function LandingRoutePage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LandingPage />
    </div>
  );
}
