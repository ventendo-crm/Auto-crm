"use client";

import { useParams } from "next/navigation";
import { PublicSelectionView } from "@/components/catalog/public-selection-view";

export default function PublicSelectionPage() {
  const params = useParams<{ token: string }>();
  if (!params.token) return null;
  return <PublicSelectionView token={params.token} />;
}
