import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Авто из каталога",
  robots: { index: false, follow: false },
};

export default function PublicCatalogVehicleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
