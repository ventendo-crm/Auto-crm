export type CatalogVehicleListItem = {
  id: string;
  source: "MANUAL" | "CHE168";
  sourceUrl: string | null;
  titleRu: string;
  titleZh: string;
  brand: string | null;
  model: string | null;
  carYear: number | null;
  mileageKm: number | null;
  priceCny: number | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  videoUrl: string | null;
  status: "ACTIVE" | "ARCHIVED";
  estimate: {
    totalWithCar: number;
    input: unknown;
    result: unknown;
  } | null;
};

export type CatalogVehicleDetail = CatalogVehicleListItem & {
  descriptionRu: string;
  descriptionZh: string;
  volumeCc: number | null;
  powerHp: number | null;
  fuelType: string | null;
  transmission: string | null;
  color: string | null;
  location: string | null;
  vin: string | null;
  importedAt: string | null;
  createdByName: string;
};

export type CatalogSelectionListItem = {
  id: string;
  title: string;
  note: string;
  dealId: string | null;
  createdByName: string;
  updatedAt: string;
  items: Array<{
    id: string;
    vehicle: {
      id: string;
      titleRu: string;
      coverImageUrl: string | null;
      priceCny: number | null;
      estimateTotal: number | null;
    };
  }>;
  shareTokens: Array<{
    id: string;
    label: string | null;
    active: boolean;
    viewCount: number;
  }>;
};

export type CatalogShareLink = {
  id: string;
  token: string;
  url: string;
  label: string | null;
  expiresAt: string | null;
};

export type PublicSelectionData = {
  title: string;
  note: string;
  companyName: string;
  items: Array<{
    id: string;
    note: string;
    vehicle: {
      id: string;
      titleRu: string;
      brand: string | null;
      model: string | null;
      carYear: number | null;
      mileageKm: number | null;
      priceCny: number | null;
      coverImageUrl: string | null;
      galleryUrls: string[];
      descriptionRu: string;
      videoUrl: string | null;
      estimateTotal: number | null;
      estimateResult: unknown;
      estimateInput: unknown;
    };
  }>;
};
