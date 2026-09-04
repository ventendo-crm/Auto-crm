import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND_ICON_MIME, getBrandIconUrl } from "@/lib/brand-icon";
import "./globals.css";
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Auto-CRM",
  description: "CRM для импорта автомобилей",
  icons: {
    icon: [{ url: getBrandIconUrl(), type: BRAND_ICON_MIME }],
    apple: [{ url: getBrandIconUrl(), type: BRAND_ICON_MIME }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem("autocrm-theme");var dark=t==="dark";if(dark)d.classList.add("dark");var raw=localStorage.getItem("autocrm-brand");if(!raw)return;var p=JSON.parse(raw);var hsl=p&&p.brandHsl;if(!hsl||!/^\\d+(?:\\.\\d+)?\\s+\\d+(?:\\.\\d+)?%\\s+\\d+(?:\\.\\d+)?%$/.test(String(hsl).trim()))return;var m=String(hsl).trim().match(/^(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%$/);var muted;if(!m){muted=dark?"14 45% 16%":"14 100% 96%"}else{var s=Math.min(Number(m[2]),dark?45:100);muted=dark?m[1]+" "+s+"% 16%":m[1]+" "+s+"% 96%"}d.style.setProperty("--brand",hsl);d.style.setProperty("--ring",hsl);d.style.setProperty("--brand-muted",muted);d.style.setProperty("--brand-foreground","0 0% 100%")}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}