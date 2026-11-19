import type { AdditionalOptionGroupDefinition } from "@/lib/additional-options";

export type OfferEquipmentItem = {
  key: string;
  label: string;
};

export type OfferEquipmentGroup = AdditionalOptionGroupDefinition;

/** Заводская комплектация для Подбора — не путать с доп. опциями сделки (установка/сервис). */
export const OFFER_EQUIPMENT_GROUPS: OfferEquipmentGroup[] = [
  {
    id: "body",
    title: "Кузов и привод",
    options: [
      { key: "awd", label: "Полный привод (4WD / AWD)" },
      { key: "air_suspension", label: "Пневмоподвеска" },
      { key: "electric_tailgate", label: "Электропривод крышки багажника" },
      { key: "power_doors", label: "Электропривод дверей" },
      { key: "running_boards", label: "Выдвижные пороги" },
      { key: "tow_hitch", label: "Фаркоп" },
      { key: "panoramic_roof", label: "Панорамная крыша" },
      { key: "roof_rails", label: "Рейлинги" },
    ],
  },
  {
    id: "interior",
    title: "Салон",
    options: [
      { key: "leather", label: "Кожаный салон" },
      { key: "nappa", label: "Салон Nappa" },
      { key: "ventilated_seats", label: "Вентиляция сидений" },
      { key: "heated_seats", label: "Подогрев сидений" },
      { key: "massage_seats", label: "Массаж сидений" },
      { key: "memory_seats", label: "Память сидений" },
      { key: "heated_steering", label: "Подогрев руля" },
      { key: "ambient_light", label: "Атмосферная подсветка" },
      { key: "fridge", label: "Холодильник" },
      { key: "wireless_charger", label: "Беспроводная зарядка" },
      { key: "premium_audio", label: "Премиум-аудио (Harman / Dynaudio)" },
    ],
  },
  {
    id: "lights",
    title: "Свет",
    options: [
      { key: "matrix_lights", label: "Матричные фары" },
      { key: "adaptive_lights", label: "Адаптивный свет" },
      { key: "auto_high_beam", label: "Автоматический дальний свет" },
    ],
  },
  {
    id: "driver_assist",
    title: "Помощь водителю",
    options: [
      { key: "camera_360", label: "Камеры 360°" },
      { key: "parking_sensors", label: "Парктроники" },
      { key: "auto_park", label: "Автопарковка" },
      { key: "lidar", label: "LiDAR" },
      { key: "hud", label: "Проекция на лобовое (HUD)" },
      { key: "adaptive_cruise", label: "Адаптивный круиз-контроль" },
      { key: "lane_keep", label: "Удержание в полосе" },
      { key: "blind_spot", label: "Контроль слепых зон" },
      { key: "autopilot", label: "Автопилот / NOA" },
    ],
  },
  {
    id: "media",
    title: "Мультимедиа",
    options: [
      { key: "large_screen", label: "Большой экран" },
      { key: "rear_screens", label: "Экраны для пассажиров сзади" },
      { key: "carplay", label: "Apple CarPlay" },
      { key: "android_auto", label: "Android Auto" },
      { key: "voice_assistant", label: "Голосовой ассистент" },
    ],
  },
  {
    id: "other",
    title: "Прочее",
    options: [
      { key: "spare_tire", label: "Полноразмерная запаска" },
      { key: "second_battery", label: "Дополнительный аккумулятор" },
      { key: "air_purifier", label: "Очиститель воздуха" },
      { key: "heat_pump", label: "Тепловой насос" },
    ],
  },
];

export function cloneOfferEquipmentGroups(): OfferEquipmentGroup[] {
  return OFFER_EQUIPMENT_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    options: group.options.map((option) => ({ key: option.key, label: option.label })),
  }));
}

export function parseOfferEquipmentKeys(raw: unknown): string[] {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseOfferEquipmentKeys(JSON.parse(trimmed));
    } catch {
      return parseOfferEquipmentKeys(trimmed.split(/[\s,]+/).filter(Boolean));
    }
  }
  if (!Array.isArray(raw)) return [];

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && "key" in item && typeof (item as { key: unknown }).key === "string"
          ? (item as { key: string }).key.trim()
          : "";
    if (!key || seen.has(key) || !/^[a-z][a-z0-9_]{1,62}$/.test(key) || key.startsWith("custom_")) {
      continue;
    }
    seen.add(key);
    keys.push(key);
    if (keys.length >= 120) break;
  }
  return keys;
}

/** Подписи берём из каталога компании в порядке групп, чтобы публичная страница не зависела от правок после шаринга. */
export function snapshotOfferEquipment(
  keys: unknown,
  groups: OfferEquipmentGroup[],
): OfferEquipmentItem[] {
  const selected = new Set(parseOfferEquipmentKeys(keys));
  if (selected.size === 0) return [];

  const items: OfferEquipmentItem[] = [];
  for (const group of groups) {
    for (const option of group.options) {
      if (!selected.has(option.key)) continue;
      const label = option.label.trim().slice(0, 200);
      if (!label) continue;
      items.push({ key: option.key, label });
      selected.delete(option.key);
      if (items.length >= 120) return items;
    }
  }
  return items;
}

export function formatOfferEquipmentLines(equipment?: Array<{ label: string }> | null): string {
  const labels = (equipment ?? []).map((item) => item.label.trim()).filter(Boolean);
  if (labels.length === 0) return "";
  return labels.map((label) => `• ${label}`).join("\n");
}
