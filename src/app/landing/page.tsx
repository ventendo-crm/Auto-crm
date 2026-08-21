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

const LANDING_KEYWORDS = [
  "CRM для импорта автомобилей",
  "CRM для импорта авто",
  "ImportCRM",
  "калькулятор растаможки",
  "растаможка авто калькулятор",
  "растаможка из Китая",
  "растаможка из Кореи",
  "растаможка из Киргизии",
  "утильсбор калькулятор",
  "таможенный калькулятор авто",
  "импорт автомобилей CRM",
  "канбан сделок авто",
  "личный кабинет клиента авто",
  "отслеживание автовоза",
  "CRM вместо Битрикс",
  "CRM для автоимпортёров",
  "учёт сделок импорт авто",
  "коммерческое предложение авто",
  "календарь таможни",
  "Telegram уведомления клиенту",
];

export const metadata: Metadata = {
  title: "ImportCRM — CRM и калькулятор растаможки для импорта авто из Китая, Кореи и Киргизии",
  description:
    "CRM для импорта автомобилей: калькулятор растаможки и утильсбора, канбан сделок, кабинет клиента, карта автовоза и Telegram. Проще Битрикса. 5 000 ₽/мес, 30 дней бесплатно.",
  keywords: LANDING_KEYWORDS,
  alternates: {
    canonical: "https://importcrm.ru/landing",
  },
  openGraph: {
    title: "ImportCRM — CRM для импорта автомобилей",
    description:
      "Калькулятор растаможки, канбан, кабинет клиента и карта автовоза в одной системе. Для компаний, которые возят авто из Китая, Кореи и Киргизии.",
    url: "https://importcrm.ru/landing",
    siteName: "ImportCRM",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImportCRM — CRM для импорта авто",
    description:
      "Калькулятор растаможки, канбан сделок, кабинет клиента и отслеживание автовоза. 30 дней бесплатно.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingRoutePage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LandingPage />
    </div>
  );
}
