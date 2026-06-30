import { DealStageType } from "@prisma/client";

export const MAX_PROCESS_ENTRY_MEDIA = 20;

export const STAGE_ORDER: DealStageType[] = [
  DealStageType.LEADS,
  DealStageType.SEARCH,
  DealStageType.INVOICE,
  DealStageType.PREPARATION,
  DealStageType.CUSTOMS,
  DealStageType.TRANSPORT,
  DealStageType.DELIVERY,
];

export const STAGE_LABELS: Record<DealStageType, string> = {
  [DealStageType.LEADS]: "Лиды",
  [DealStageType.SEARCH]: "Поиск авто",
  [DealStageType.INVOICE]: "Инвойс",
  [DealStageType.PREPARATION]: "Подготовка",
  [DealStageType.CUSTOMS]: "Таможня",
  [DealStageType.TRANSPORT]: "Транспортировка",
  [DealStageType.DELIVERY]: "Получение",
};

/** Сообщения клиенту при переходе сделки на этап (личный кабинет + Telegram). */
export const CLIENT_STAGE_NOTIFICATIONS: Record<DealStageType, string> = {
  [DealStageType.LEADS]:
    "Ваша заявка принята в работу. Менеджер свяжется с вами при необходимости.",
  [DealStageType.SEARCH]:
    "Мы начали поиск автомобиля по вашим параметрам. Новые варианты появятся в личном кабинете.",
  [DealStageType.INVOICE]:
    "Вам выставили инвойс, для его оплаты обратитесь в ВТБ банк.",
  [DealStageType.PREPARATION]:
    "Автомобиль готовится к отправке. Мы сообщим о следующих шагах.",
  [DealStageType.CUSTOMS]:
    "Автомобиль находится на таможенном оформлении.",
  [DealStageType.TRANSPORT]:
    "Автомобиль в пути. Следите за обновлениями в личном кабинете.",
  [DealStageType.DELIVERY]:
    "Автомобиль готов к получению. Спасибо, что выбрали нас!",
};

export const STAGE_COLORS: Record<DealStageType, string> = {
  [DealStageType.LEADS]:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  [DealStageType.SEARCH]:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  [DealStageType.INVOICE]:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  [DealStageType.PREPARATION]:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  [DealStageType.CUSTOMS]:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  [DealStageType.TRANSPORT]:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  [DealStageType.DELIVERY]:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
};

export const STAGE_COLUMN_BG: Record<DealStageType, string> = {
  [DealStageType.LEADS]: "border-t-amber-400",
  [DealStageType.SEARCH]: "border-t-blue-400",
  [DealStageType.INVOICE]: "border-t-orange-400",
  [DealStageType.PREPARATION]: "border-t-purple-400",
  [DealStageType.CUSTOMS]: "border-t-rose-400",
  [DealStageType.TRANSPORT]: "border-t-emerald-400",
  [DealStageType.DELIVERY]: "border-t-teal-400",
};

export const DOCUMENT_LABELS = {
  PASSPORT: "Паспорт",
  PASSPORT_2: "Паспорт (2-й файл)",
  INN: "ИНН",
  SNILS: "СНИЛС",
  PAYMENT: "Оплата",
  INVOICE: "Инвойс",
  CUSTOMS_DUTY: "Таможенная пошлина",
  CUSTOMS_DUTY_RECEIPT: "Чек об оплате таможенной пошлины",
  BROKER_SERVICES_RECEIPT: "Квитанция услуг брокера",
  BROKER_PAYMENT_RECEIPT: "Чек об оплате услуг брокера",
  EPTS: "ЭПТС",
  PTD: "ПТД",
  SBKTS: "СБКТС",
} as const;

export const CLIENT_DOCUMENT_ORDER = [
  "PASSPORT",
  "INN",
  "SNILS",
  "INVOICE",
  "PAYMENT",
  "CUSTOMS_DUTY",
  "CUSTOMS_DUTY_RECEIPT",
  "BROKER_SERVICES_RECEIPT",
  "BROKER_PAYMENT_RECEIPT",
] as const;

export const RECEIVED_DOCUMENT_ORDER = ["EPTS", "PTD", "SBKTS"] as const;

export const PASSPORT_DOCUMENT_TYPES = ["PASSPORT", "PASSPORT_2"] as const;

export const PASSPORT_FILE_LABELS = ["Файл 1", "Файл 2"] as const;

/** @deprecated Use CLIENT_DOCUMENT_ORDER or RECEIVED_DOCUMENT_ORDER */
export const DOCUMENT_ORDER = CLIENT_DOCUMENT_ORDER;

export const DOCUMENT_STATUS_LABELS = {
  MISSING: "Отсутствует",
  RECEIVED: "Получен",
  VERIFIED: "Проверен",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  VIEWER: "Наблюдатель",
  CLIENT: "Клиент",
};

export const COMMENT_AUTHOR_ROLE_LABELS: Record<string, string> = {
  CLIENT: "Клиент",
  MANAGER: "Менеджер",
  ADMIN: "Администратор",
  VIEWER: "Наблюдатель",
};
