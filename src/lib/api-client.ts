import { DealStageType, DocumentType } from "@prisma/client";
import {
  ApiResponse,
  AuthProfile,
  CommentItem,
  ClientPortalDeal,
  CompanyListItem,
  CompanyTelegramBotSettings,
  CompanyGoogleCalendarSettings,
  DashboardData,
  DealDetail,
  DealListItem,
  DocumentItem,
  EmailTemplateItem,
  TelegramTemplateItem,
  ClientStageMessageItem,
  MediaItem,
  NotificationItem,
  Paginated,
  ReminderItem,
  Role,
  ImportProcessEntry,
  CarCarrierTrackingPoint,
  CarCarrierTrackingData,
  CarCarrierDestination,
  GeocodeResult,
  SearchProcessEntry,
  SearchProcessData,
  SearchProcessLinks,
  StageHistoryItem,
  User,
} from "@/lib/types";
import { DealActivityItem } from "@/lib/services/deal-activity";
import { AdditionalOptionGroupState } from "@/lib/services/additional-options";
import { DealExpenseItem } from "@/lib/services/deal-expenses";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = (await response.json()) as ApiResponse<T> & { data?: unknown };

  if (!response.ok || !json.success) {
    throw new ApiRequestError(
      json.error ?? `Request failed: ${response.status}`,
      response.status,
      "data" in json ? json.data : undefined,
    );
  }

  return json.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string, companySlug?: string) =>
      request<{ user: User; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(companySlug ? { companySlug } : {}) }),
      }),
    logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
    me: () => request<User>("/api/auth/me"),
    listProfiles: () => request<AuthProfile[]>("/api/auth/profiles"),
    switchProfile: (userId: string) =>
      request<User>("/api/auth/switch-profile", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    linkTelegram: (telegramChatId: string) =>
      request<User>("/api/auth/telegram", {
        method: "PATCH",
        body: JSON.stringify({ telegramChatId }),
      }),
    unlinkTelegram: () => request<User>("/api/auth/telegram", { method: "DELETE" }),
    testTelegram: () =>
      request<{ delivered: boolean; chatId: string }>("/api/auth/telegram/test", {
        method: "POST",
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    requestPasswordReset: (email: string, companySlug?: string) =>
      request<{ message: string }>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email, ...(companySlug ? { companySlug } : {}) }),
      }),
    confirmPasswordReset: (token: string, password: string) =>
      request<{ message: string }>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
  },

  companies: {
    list: () => request<CompanyListItem[]>("/api/companies"),
    create: (data: {
      name: string;
      slug?: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
    }) =>
      request<CompanyListItem>("/api/companies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  dashboard: {
    get: (managerId?: string) => {
      const query = managerId ? `?managerId=${encodeURIComponent(managerId)}` : "";
      return request<DashboardData>(`/api/dashboard/stats${query}`);
    },
    getLayout: () =>
      request<{
        companyId: string;
        layout: Array<{ id: string; enabled: boolean; sortOrder: number }>;
        updatedAt: string | null;
      }>("/api/dashboard/layout"),
    saveLayout: (
      layout: Array<{ id: string; enabled: boolean; sortOrder: number }>,
    ) =>
      request<{
        companyId: string;
        layout: Array<{ id: string; enabled: boolean; sortOrder: number }>;
        updatedAt: string | null;
      }>("/api/dashboard/layout", {
        method: "PUT",
        body: JSON.stringify({ layout }),
      }),
  },

  companyAppearance: {
    get: () =>
      request<import("@/lib/services/company-appearance").CompanyAppearanceDto>(
        "/api/company/appearance",
      ),
    save: (data: { presetId: string; customBrandHsl?: string | null }) =>
      request<import("@/lib/services/company-appearance").CompanyAppearanceDto>(
        "/api/company/appearance",
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    uploadLogo: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/company/appearance/logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = (await response.json()) as {
        success: boolean;
        data?: import("@/lib/services/company-appearance").CompanyAppearanceDto;
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Не удалось загрузить логотип");
      }
      return json.data;
    },
    clearLogo: () =>
      request<import("@/lib/services/company-appearance").CompanyAppearanceDto>(
        "/api/company/appearance/logo",
        { method: "DELETE" },
      ),
  },

  deals: {
    list: (params?: {
      stage?: DealStageType;
      search?: string;
      managerId?: string;
      destinationCountry?: string;
      page?: number;
      limit?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.stage) query.set("stage", params.stage);
      if (params?.search) query.set("search", params.search);
      if (params?.managerId) query.set("managerId", params.managerId);
      if (params?.destinationCountry) {
        query.set("destinationCountry", params.destinationCountry);
      }
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<Paginated<DealListItem>>(`/api/deals${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<DealDetail>(`/api/deals/${id}`),
    activity: (id: string) => request<DealActivityItem[]>(`/api/deals/${id}/activity`),
    clearActivity: async (id: string) => {
      const response = await fetch(`/api/deals/${id}/activity`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Clear activity failed");
      }
    },
    shipment: {
      get: (dealId: string) => request<import("@/lib/types").Shipment | null>(`/api/deals/${dealId}/shipment`),
      save: (
        dealId: string,
        data: {
          purchaseDate?: string | null;
          shippingDate?: string | null;
          expectedArrival?: string | null;
          actualArrival?: string | null;
          customsCompleted?: string | null;
        },
      ) =>
        request<import("@/lib/types").Shipment>(`/api/deals/${dealId}/shipment`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },
    create: (data: Record<string, unknown>) =>
      request<DealListItem>("/api/deals", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<DealListItem>(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    changeStage: (id: string, toStage: DealStageType) =>
      request<{ deal: DealListItem; history: StageHistoryItem }>(`/api/deals/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ toStage }),
      }),
    delete: async (id: string) => {
      const response = await fetch(`/api/deals/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    createClientAccount: (
      dealId: string,
      data: { name: string; email: string; password: string },
    ) =>
      request<{
        clientUser: User;
        telegramInvite: {
          inviteUrl: string;
          botUsername: string;
          telegramLinked: boolean;
          telegramChatId: string | null;
          expiresAt: string;
        } | null;
      }>(`/api/deals/${dealId}/client-account`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getTelegramInvite: (dealId: string) =>
      request<{
        inviteUrl: string;
        botUsername: string;
        telegramLinked: boolean;
        telegramChatId: string | null;
        expiresAt: string;
      }>(`/api/deals/${dealId}/client-account/telegram-invite`),
    refreshTelegramInvite: (dealId: string) =>
      request<{
        inviteUrl: string;
        botUsername: string;
        telegramLinked: boolean;
        telegramChatId: string | null;
        expiresAt: string;
      }>(`/api/deals/${dealId}/client-account/telegram-invite`, {
        method: "POST",
      }),
    unlinkClientAccount: async (dealId: string) => {
      const response = await fetch(`/api/deals/${dealId}/client-account`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Unlink failed");
      }
    },
    additionalOptions: {
      list: (dealId: string) =>
        request<AdditionalOptionGroupState[]>(`/api/deals/${dealId}/additional-options`),
      create: (dealId: string, data: { label: string; groupId: string }) =>
        request<{
          optionKey: string;
          label: string | null;
          groupId: string | null;
          isCustom: boolean;
          checked: boolean;
          updatedAt: string;
          updatedBy: { id: string; name: string } | null;
        }>(`/api/deals/${dealId}/additional-options`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      toggle: (dealId: string, optionKey: string, checked: boolean) =>
        request<{ checked: boolean; updatedAt: string; updatedBy: { id: string; name: string } | null }>(
          `/api/deals/${dealId}/additional-options`,
          {
            method: "PATCH",
            body: JSON.stringify({ optionKey, checked }),
          },
        ),
    },
    expenses: {
      list: (dealId: string) => request<DealExpenseItem[]>(`/api/deals/${dealId}/expenses`),
      save: (dealId: string, expenses: { description: string; amount: number }[]) =>
        request<DealExpenseItem[]>(`/api/deals/${dealId}/expenses`, {
          method: "PUT",
          body: JSON.stringify({ expenses }),
        }),
    },
    customsEstimates: {
      list: (dealId: string) =>
        request<import("@/lib/services/deal-customs-estimates").DealCustomsEstimateItem[]>(
          `/api/deals/${dealId}/customs-estimates`,
        ),
      create: (
        dealId: string,
        data: {
          input: import("@/lib/customs-calculator").CustomsCalculatorInput;
          note?: string | null;
        },
      ) =>
        request<import("@/lib/services/deal-customs-estimates").DealCustomsEstimateItem>(
          `/api/deals/${dealId}/customs-estimates`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
        ),
      delete: async (dealId: string, estimateId: string) => {
        const response = await fetch(
          `/api/deals/${dealId}/customs-estimates/${estimateId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (!response.ok) {
          const json = (await response.json()) as ApiResponse<unknown>;
          throw new Error(json.error ?? "Не удалось удалить расчёт");
        }
      },
    },
    setImportProcessEnabled: (dealId: string, enabled: boolean) =>
      request<{ importProcessEnabled: boolean }>(`/api/deals/${dealId}/import-process`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
  },

  reminders: {
    today: () => request<ReminderItem[]>("/api/reminders"),
    listByDeal: (dealId: string) => request<ReminderItem[]>(`/api/deals/${dealId}/reminders`),
    create: (dealId: string, data: { title: string; dueDate: string }) =>
      request<ReminderItem>(`/api/deals/${dealId}/reminders`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { title?: string; dueDate?: string; completed?: boolean }) =>
      request<ReminderItem>(`/api/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: async (id: string) => {
      const response = await fetch(`/api/reminders/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
  },

  importProcess: {
    listEntries: (dealId: string) =>
      request<ImportProcessEntry[]>(`/api/deals/${dealId}/import-process/entries`),
    createEntry: (dealId: string) =>
      request<ImportProcessEntry>(`/api/deals/${dealId}/import-process/entries`, {
        method: "POST",
      }),
    updateEntry: (dealId: string, entryId: string, description: string) =>
      request<ImportProcessEntry>(`/api/deals/${dealId}/import-process/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ description }),
      }),
    deleteEntry: async (dealId: string, entryId: string) => {
      const response = await fetch(
        `/api/deals/${dealId}/import-process/entries/${entryId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    uploadMedia: async (dealId: string, entryId: string, files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(
        `/api/deals/${dealId}/import-process/entries/${entryId}/media`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const json = (await response.json()) as ApiResponse<MediaItem | MediaItem[]>;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      return json.data as MediaItem | MediaItem[];
    },
  },

  carCarrierTracking: {
    get: (dealId: string) =>
      request<CarCarrierTrackingData>(`/api/deals/${dealId}/car-carrier-tracking`),
    list: (dealId: string) =>
      request<CarCarrierTrackingData>(`/api/deals/${dealId}/car-carrier-tracking`).then(
        (data) => data.points,
      ),
    create: (
      dealId: string,
      data: {
        latitude: number;
        longitude: number;
        title?: string;
        description?: string;
        recordedAt?: string;
      },
    ) =>
      request<CarCarrierTrackingPoint>(`/api/deals/${dealId}/car-carrier-tracking`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      dealId: string,
      pointId: string,
      data: {
        latitude?: number;
        longitude?: number;
        title?: string;
        description?: string;
        recordedAt?: string;
      },
    ) =>
      request<CarCarrierTrackingPoint>(
        `/api/deals/${dealId}/car-carrier-tracking/${pointId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    delete: async (dealId: string, pointId: string) => {
      const response = await fetch(
        `/api/deals/${dealId}/car-carrier-tracking/${pointId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    uploadMedia: async (dealId: string, pointId: string, files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(
        `/api/deals/${dealId}/car-carrier-tracking/${pointId}/media`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const json = (await response.json()) as ApiResponse<MediaItem | MediaItem[]>;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      return json.data as MediaItem | MediaItem[];
    },
    setDestination: (
      dealId: string,
      data: { latitude: number; longitude: number; title?: string },
    ) =>
      request<CarCarrierDestination>(`/api/deals/${dealId}/car-carrier-tracking/destination`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateDestinationTitle: (dealId: string, title: string) =>
      request<CarCarrierDestination>(`/api/deals/${dealId}/car-carrier-tracking/destination`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    clearDestination: async (dealId: string) => {
      const response = await fetch(
        `/api/deals/${dealId}/car-carrier-tracking/destination`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
  },

  geocode: {
    search: (query: string) => {
      const params = new URLSearchParams({ q: query });
      return request<GeocodeResult[]>(`/api/geocode/search?${params.toString()}`);
    },
  },

  exchangeRates: {
    get: (force = false) => {
      const params = force ? "?force=1" : "";
      return request<{
        rates: { USD: number; EUR: number; CNY: number; KRW: number };
        fetchedAt: string;
        source: "google-finance" | "google-search" | "yahoo";
        cached: boolean;
      }>(`/api/exchange-rates${params}`);
    },
  },

  calculatorSettings: {
    get: () =>
      request<import("@/lib/services/calculator-settings").CalculatorSettingsDto>(
        "/api/calculator/settings",
      ),
    savePresets: (
      presets: import("@/lib/validators/calculator-settings").CalculatorPresetInput[],
    ) =>
      request<import("@/lib/services/calculator-settings").CalculatorSettingsDto>(
        "/api/calculator/settings",
        {
          method: "PUT",
          body: JSON.stringify({ presets }),
        },
      ),
    uploadLogo: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/calculator/settings/logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = (await response.json()) as {
        success: boolean;
        data?: import("@/lib/services/calculator-settings").CalculatorSettingsDto;
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Не удалось загрузить логотип");
      }
      return json.data;
    },
    deleteLogo: () =>
      request<import("@/lib/services/calculator-settings").CalculatorSettingsDto>(
        "/api/calculator/settings/logo",
        { method: "DELETE" },
      ),
  },

  calculatorExpenseTemplate: {
    get: () =>
      request<import("@/lib/services/company-calculator-settings").CompanyCalculatorSettingsDto>(
        "/api/calculator/expense-template",
      ),
    save: (
      expenseItems: import("@/lib/customs-calculator/expense-template").CalculatorExpenseItem[],
      customOrigins?: import("@/lib/customs-calculator/custom-origins").CustomCalculatorOrigin[],
    ) =>
      request<import("@/lib/services/company-calculator-settings").CompanyCalculatorSettingsDto>(
        "/api/calculator/expense-template",
        {
          method: "PUT",
          body: JSON.stringify({
            expenseItems,
            ...(customOrigins ? { customOrigins } : {}),
          }),
        },
      ),
    addOrigin: (label: string) =>
      request<import("@/lib/services/company-calculator-settings").CompanyCalculatorSettingsDto>(
        "/api/calculator/expense-template",
        {
          method: "POST",
          body: JSON.stringify({ label }),
        },
      ),
    removeOrigin: (originId: string) =>
      request<import("@/lib/services/company-calculator-settings").CompanyCalculatorSettingsDto>(
        `/api/calculator/expense-template/origins/${encodeURIComponent(originId)}`,
        { method: "DELETE" },
      ),
  },

  quickSearch: {
    search: (query: string) =>
      request<{
        summary: string;
        variants: Array<{
          answer: string;
          sourceUrl: string | null;
          sourceTitle: string | null;
        }>;
      }>("/api/quick-search", {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
  },

  myDeal: {
    get: () => request<ClientPortalDeal>("/api/my-deal"),
  },

  comments: {
    list: (dealId: string) => request<CommentItem[]>(`/api/deals/${dealId}/comments`),
    create: (dealId: string, text: string) =>
      request<CommentItem>(`/api/deals/${dealId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    update: (id: string, text: string) =>
      request<CommentItem>(`/api/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      }),
    delete: async (id: string) => {
      const response = await fetch(`/api/comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
  },

  stageHistory: {
    list: (dealId: string) => request<StageHistoryItem[]>(`/api/deals/${dealId}/stage-history`),
  },

  documents: {
    upload: async (dealId: string, type: DocumentType, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dealId", dealId);
      formData.append("type", type);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const json = (await response.json()) as ApiResponse<DocumentItem>;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      return json.data as DocumentItem;
    },
    updateStatus: (dealId: string, type: DocumentType, status: "RECEIVED" | "VERIFIED") =>
      request<DocumentItem>(`/api/deals/${dealId}/documents/${type}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    delete: (dealId: string, type: DocumentType) =>
      request<DocumentItem>(`/api/deals/${dealId}/documents/${type}`, {
        method: "DELETE",
      }),
  },

  searchProcess: {
    list: (dealId: string) =>
      request<SearchProcessData>(`/api/deals/${dealId}/search-process`),
    updateLinks: (dealId: string, data: Partial<SearchProcessLinks>) =>
      request<SearchProcessLinks>(`/api/deals/${dealId}/search-process/links`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    recalculateEstimates: (dealId: string) =>
      request<{ updated: number }>(`/api/deals/${dealId}/search-process/estimates/recalculate`, {
        method: "POST",
      }),
    create: (dealId: string) =>
      request<SearchProcessEntry>(`/api/deals/${dealId}/search-process`, { method: "POST" }),
    update: (dealId: string, entryId: string, description: string) =>
      request<SearchProcessEntry>(`/api/deals/${dealId}/search-process/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ description }),
      }),
    getEstimate: (dealId: string, entryId: string) =>
      request<import("@/lib/types").SearchProcessEntryEstimate | null>(
        `/api/deals/${dealId}/search-process/${entryId}/estimate`,
      ),
    saveEstimate: (
      dealId: string,
      entryId: string,
      data: {
        price: number;
        currency: "RUB" | "USD" | "CNY" | "KRW";
        powerHp: number;
        volumeCc: number;
        carYear: number;
        chinaExpensesCny?: number;
        cityDeliveryUsd?: number;
        koreaDocsDeliveryKrw?: number;
        parkingFeeKrw?: number;
        brokerFeeRub?: number;
        deliveryRoute?: "ussuriysk" | "kazakhstan" | "vladivostok";
        deliveryRub?: number;
        deliveryUsd?: number;
        escortRub?: number;
        note?: string | null;
      },
    ) =>
      request<import("@/lib/types").SearchProcessEntryEstimate>(
        `/api/deals/${dealId}/search-process/${entryId}/estimate`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    deleteEstimate: async (dealId: string, entryId: string) => {
      const response = await fetch(`/api/deals/${dealId}/search-process/${entryId}/estimate`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    submitFeedback: (dealId: string, entryId: string, feedback: string) =>
      request<SearchProcessEntry>(
        `/api/deals/${dealId}/search-process/${entryId}/feedback`,
        {
          method: "PATCH",
          body: JSON.stringify({ feedback }),
        },
      ),
    delete: async (dealId: string, entryId: string) => {
      const response = await fetch(`/api/deals/${dealId}/search-process/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    uploadMedia: async (dealId: string, entryId: string, files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(
        `/api/deals/${dealId}/search-process/${entryId}/media`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const json = (await response.json()) as ApiResponse<MediaItem | MediaItem[]>;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      return json.data as MediaItem | MediaItem[];
    },
  },

  media: {
    list: (dealId: string) => request<MediaItem[]>(`/api/deals/${dealId}/media`),
    upload: async (dealId: string, files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(`/api/deals/${dealId}/media`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const json = (await response.json()) as ApiResponse<MediaItem | MediaItem[]>;

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Upload failed");
      }

      return json.data as MediaItem | MediaItem[];
    },
    delete: async (id: string) => {
      const response = await fetch(`/api/media/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
    get: (id: string) => request<MediaItem>(`/api/media/${id}`),
  },

  notifications: {
    list: (params?: { read?: boolean; page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.read !== undefined) query.set("read", String(params.read));
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<Paginated<NotificationItem>>(`/api/notifications${qs ? `?${qs}` : ""}`);
    },
    markRead: (id: string) =>
      request<NotificationItem>(`/api/notifications/${id}`, { method: "PATCH" }),
    markAllRead: () =>
      request<{ updated: number }>("/api/notifications/read-all", { method: "POST" }),
  },

  push: {
    getPublicKey: () => request<{ publicKey: string }>("/api/push/vapid-public-key"),
    subscribe: (data: { endpoint: string; p256dh: string; auth: string }) =>
      request<{ id: string }>("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    unsubscribe: (data?: { endpoint: string }) =>
      request<{ removed: number }>("/api/push/subscribe", {
        method: "DELETE",
        body: JSON.stringify(data ?? {}),
      }),
    test: () => request<{ delivered: boolean }>("/api/push/test", { method: "POST" }),
  },

  email: {
    status: () => request<{ configured: boolean }>("/api/email/status"),
    test: () => request<{ delivered: boolean; to: string }>("/api/email/test", { method: "POST" }),
    listTemplates: () => request<EmailTemplateItem[]>("/api/email/templates"),
    updateTemplate: (
      key: string,
      data: { subject: string; textBody: string; htmlTitle: string },
    ) =>
      request<EmailTemplateItem>(`/api/email/templates/${key}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  help: {
    feedbackStatus: () => request<{ configured: boolean }>("/api/help/feedback"),
    sendFeedback: (data: {
      topic: "question" | "bug" | "idea" | "other";
      message: string;
    }) =>
      request<{ message: string }>("/api/help/feedback", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  telegram: {
    getBotSettings: () => request<CompanyTelegramBotSettings>("/api/telegram/bot-settings"),
    connectBot: (data: { token: string; defaultChatId?: string | null }) =>
      request<CompanyTelegramBotSettings>("/api/telegram/bot-settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    disconnectBot: () =>
      request<CompanyTelegramBotSettings>("/api/telegram/bot-settings", {
        method: "DELETE",
      }),
    listTemplates: () => request<TelegramTemplateItem[]>("/api/telegram/templates"),
    updateTemplate: (key: string, data: { textBody: string }) =>
      request<TelegramTemplateItem>(`/api/telegram/templates/${key}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    listStageMessages: () =>
      request<ClientStageMessageItem[]>("/api/telegram/stage-messages"),
    updateStageMessages: (messages: Array<{ stage: string; textBody: string }>) =>
      request<ClientStageMessageItem[]>("/api/telegram/stage-messages", {
        method: "PUT",
        body: JSON.stringify({ messages }),
      }),
  },

  googleCalendar: {
    getSettings: () => request<CompanyGoogleCalendarSettings>("/api/google-calendar/settings"),
    connect: (data: { googleEmail: string }) =>
      request<{ url: string }>("/api/google-calendar/connect", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    disconnect: () =>
      request<CompanyGoogleCalendarSettings>("/api/google-calendar/settings", {
        method: "DELETE",
      }),
    syncNow: () =>
      request<CompanyGoogleCalendarSettings>("/api/google-calendar/sync", {
        method: "POST",
      }),
  },

  users: {
    list: () => request<User[]>("/api/users"),
    create: (data: { name: string; email: string; password: string; role?: "ADMIN" | "MANAGER" | "VIEWER" }) =>
      request<User>("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const json = (await response.json()) as ApiResponse<unknown>;
        throw new Error(json.error ?? "Delete failed");
      }
    },
  },

  roles: {
    list: () => request<Role[]>("/api/roles"),
  },
};
