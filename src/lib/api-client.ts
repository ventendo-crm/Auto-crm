import { DealStageType, DocumentType } from "@prisma/client";
import {
  ApiResponse,
  CommentItem,
  ClientPortalDeal,
  DashboardData,
  DealDetail,
  DealListItem,
  DocumentItem,
  MediaItem,
  NotificationItem,
  Paginated,
  ReminderItem,
  Role,
  ImportProcessEntry,
  SearchProcessEntry,
  SearchProcessData,
  SearchProcessLinks,
  StageHistoryItem,
  User,
} from "@/lib/types";
import { DealActivityItem } from "@/lib/services/deal-activity";
import { AdditionalOptionGroupState } from "@/lib/services/additional-options";
import { DealExpenseItem } from "@/lib/services/deal-expenses";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new Error(json.error ?? `Request failed: ${response.status}`);
  }

  return json.data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
    me: () => request<User>("/api/auth/me"),
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
  },

  dashboard: {
    get: (managerId?: string) => {
      const query = managerId ? `?managerId=${encodeURIComponent(managerId)}` : "";
      return request<DashboardData>(`/api/dashboard/stats${query}`);
    },
  },

  deals: {
    list: (params?: {
      stage?: DealStageType;
      search?: string;
      managerId?: string;
      page?: number;
      limit?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.stage) query.set("stage", params.stage);
      if (params?.search) query.set("search", params.search);
      if (params?.managerId) query.set("managerId", params.managerId);
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return request<Paginated<DealListItem>>(`/api/deals${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<DealDetail>(`/api/deals/${id}`),
    activity: (id: string) => request<DealActivityItem[]>(`/api/deals/${id}/activity`),
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
      request<{ clientUser: User }>(`/api/deals/${dealId}/client-account`, {
        method: "POST",
        body: JSON.stringify(data),
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
  },

  searchProcess: {
    list: (dealId: string) =>
      request<SearchProcessData>(`/api/deals/${dealId}/search-process`),
    updateLinks: (dealId: string, data: Partial<SearchProcessLinks>) =>
      request<SearchProcessLinks>(`/api/deals/${dealId}/search-process/links`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    create: (dealId: string) =>
      request<SearchProcessEntry>(`/api/deals/${dealId}/search-process`, { method: "POST" }),
    update: (dealId: string, entryId: string, description: string) =>
      request<SearchProcessEntry>(`/api/deals/${dealId}/search-process/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ description }),
      }),
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
