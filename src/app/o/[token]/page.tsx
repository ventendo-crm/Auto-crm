"use client";

import { useParams } from "next/navigation";
import { PublicCalculatorOfferView } from "@/components/calculator/public-calculator-offer-view";

export default function PublicCalculatorOfferPage() {
  const params = useParams<{ token: string }>();
  if (!params.token) return null;
  return <PublicCalculatorOfferView token={params.token} />;
}
