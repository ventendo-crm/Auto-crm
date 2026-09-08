import type {
  CustomsCalculatorInput,
  CustomsCalculatorResult,
} from "@/lib/customs-calculator";

export type CatalogPhoto = {
  id: string;
  fileUrl: string;
  type: "PHOTO" | "VIDEO";
};

export type CatalogGalleryItem = {
  url: string;
  type: "photo" | "video";
};

export type CatalogSectionItem = {
  id: string;
  title: string;
  sortOrder: number;
  vehicleCount: number;
};

export type CatalogSectionsList = {
  items: CatalogSectionItem[];
  totalActiveCount: number;
};

export type CatalogRatesRecalcResult = {
  updated: number;
  skipped: number;
  failed: number;
  rates: { USD: number; EUR: number; CNY: number; KRW: number };
  fetchedAt: string;
};

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
  priceCurrency: string;
  sectionId: string | null;
  sectionTitle: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  photos: CatalogPhoto[];
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

export type CatalogShareLink = {
  token: string;
  url: string;
};

export type PublicCatalogVehicleData = {
  companyName: string;
  title: string;
  description: string;
  photos: string[];
  media: CatalogGalleryItem[];
  totalWithCar: number | null;
  estimateInput: CustomsCalculatorInput | null;
  estimateResult: CustomsCalculatorResult | null;
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
