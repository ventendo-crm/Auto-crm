import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Подбор авто",
  robots: { index: false, follow: false },
};

export default function PublicOfferLayout({ children }: { children: React.ReactNode }) {
  return children;
}
