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
    "ImportCRM — CRM для компаний, которые возят авто из-за рубежа: сделки, этапы, калькулятор растаможки, кабинет клиента и Telegram.",
};

export default function LandingRoutePage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LandingPage />
    </div>
  );
}
