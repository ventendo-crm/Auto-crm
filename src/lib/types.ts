import {
  DealStageType,
  DocumentStatus,
  DocumentType,
  MediaType,
  NotificationType,
} from "@prisma/client";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface User {
  id: string;
  name: string;
  email: string;
  telegramChatId?: string | null;
  createdAt: string;
  role: { id: string; name: string };
  clientDeal?: { id: string; clientName: string } | null;
  _count?: {
    deals?: number;
    comments?: number;
  };
}

export interface DealManager {
  id: string;
  name: string;
  email: string;
}

export interface DealListItem {
  id: string;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  vin: string;
  carBrand?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  purchasePrice?: number | null;
  prepayment?: number | null;
  balance?: number | null;
  destinationCity: string;
  destinationCountry: string;
  managerId: string;
  clientUserId?: string | null;
  clientUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  currentStage: DealStageType;
  stageEnteredAt: string;
  expectedArrival?: string | null;
  actualArrival?: string | null;
  priority: number;
  importProcessEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  manager: DealManager;
  _count?: {
    comments: number;
    tasks: number;
    documents: number;
    reminders: number;
  };
}

export interface MediaItem {
  id: string;
  type: MediaType;
  fileName: string;
  fileKey?: string;
  thumbnailKey?: string | null;
  fileUrl: string;
  thumbnailUrl?: string | null;
  size: number;
  dealId?: string | null;
  taskId?: string | null;
  uploadedById: string;
  uploadedAt: string;
  uploadedBy?: { id: string; name: string; email: string };
}

export interface SearchProcessLinks {
  inspectionLink: string | null;
  chinaAutotecaLink: string | null;
}

export interface SearchProcessData {
  entries: SearchProcessEntry[];
  links: SearchProcessLinks;
}

export interface ImportProcessEntry {
  id: string;
  dealId: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  media: MediaItem[];
}

export interface SearchProcessEntry {
  id: string;
  dealId: string;
  description: string;
  clientFeedback?: string | null;
  clientFeedbackAt?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  media: MediaItem[];
}

export interface DealDetail extends DealListItem {
  clientUser?: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  } | null;
  documents: DocumentItem[];
  shipment?: Shipment | null;
  comments: CommentItem[];
  stageHistory: StageHistoryItem[];
  media?: MediaItem[];
}

export interface DocumentItem {
  id: string;
  dealId: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl?: string | null;
  uploadedAt?: string | null;
}

export interface Shipment {
  id: string;
  dealId: string;
  purchaseDate?: string | null;
  shippingDate?: string | null;
  expectedArrival?: string | null;
  actualArrival?: string | null;
  customsCompleted?: string | null;
}

export interface CommentItem {
  id: string;
  text: string;
  dealId: string;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string; email: string; role?: { name: string } };
}

export interface StageHistoryItem {
  id: string;
  dealId: string;
  fromStage: DealStageType;
  toStage: DealStageType;
  changedById: string;
  createdAt: string;
  changedBy: { id: string; name: string; email: string };
}

export interface NotificationItem {
  id: string;
  dealId?: string | null;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  deal?: {
    id: string;
    clientName: string;
    vin: string;
    currentStage: DealStageType;
  } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Role {
  id: string;
  name: string;
}

export interface DashboardStats {
  total: number;
  completed: number;
  eta: number;
}

export interface DashboardChartData {
  byStage: { stage: DealStageType; name: string; value: number }[];
  stageBar: { name: string; count: number }[];
  statusPie: { name: string; value: number }[];
  etaDeals: { dealId: string; name: string; clientName: string; days: number; date: string }[];
  etaTimeline: { week: string; label: string; count: number }[];
}

export interface DashboardRecentDeal {
  id: string;
  clientName: string;
  vin: string;
  carBrand: string | null;
  carModel: string | null;
  currentStage: DealStageType;
  expectedArrival: string | null;
  prepayment: number | null;
  updatedAt: string;
  manager: { id: string; name: string };
}

export interface DashboardManagerStat {
  managerId: string;
  managerName: string;
  stats: DashboardStats;
}

export interface DashboardData {
  stats: DashboardStats;
  charts: DashboardChartData;
  recentDeals: DashboardRecentDeal[];
  managerStats?: DashboardManagerStat[];
}

export interface ClientPortalDeal {
  id: string;
  clientName: string;
  vin: string;
  carBrand?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  destinationCity: string;
  destinationCountry: string;
  currentStage: DealStageType;
  stageLabel: string;
  expectedArrival?: string | null;
  actualArrival?: string | null;
  manager: DealManager;
  documents: {
    id: string;
    dealId: string;
    type: DocumentType;
    label: string;
    status: DocumentStatus;
    fileUrl?: string | null;
    uploadedAt?: string | null;
  }[];
  shipment?: Shipment | null;
  stageHistory: {
    id: string;
    fromStage: DealStageType;
    toStage: DealStageType;
    fromLabel: string;
    toLabel: string;
    createdAt: string;
  }[];
  comments: {
    id: string;
    dealId: string;
    text: string;
    authorId: string;
    createdAt: string;
    author: { id: string; name: string; email: string; role?: { name: string } };
  }[];
  searchProcess: {
    id: string;
    description: string;
    sortOrder: number;
    variantNumber: number;
    clientFeedback?: string | null;
    clientFeedbackAt?: string | null;
    media: MediaItem[];
  }[];
  searchProcessLinks: SearchProcessLinks;
  importProcessEnabled: boolean;
  importProcess: {
    id: string;
    description: string;
    sortOrder: number;
    stageNumber: number;
    media: MediaItem[];
  }[];
  media: MediaItem[];
}
