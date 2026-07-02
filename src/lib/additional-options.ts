export interface AdditionalOptionDefinition {
  key: string;
  label: string;
}

export interface AdditionalOptionGroupDefinition {
  id: string;
  title: string;
  options: AdditionalOptionDefinition[];
}

export const ADDITIONAL_OPTION_GROUPS: AdditionalOptionGroupDefinition[] = [
  {
    id: "equipment",
    title: "Установка оборудования / Электрика",
    options: [
      { key: "cavity_anti_corrosion", label: "Антикоррозийная обработка скрытых полостей" },
      { key: "add_key", label: "Добавить ключ" },
      { key: "seat_heating", label: "Установка подогрева сидений" },
      { key: "floor_mats", label: "Установка ковриков" },
      { key: "steering_wheel_heating", label: "Установка подогрева руля" },
      { key: "matrix_laser_headlights", label: "Установка матричных / лазерных фар" },
      {
        key: "ambient_light",
        label: "Установка салонной атмосферной подсветки (Ambient Light)",
      },
      { key: "camera_360", label: "Установка системы кругового обзора 360°" },
      { key: "electric_trunk", label: "Установка электрической крышки багажника (электропривод)" },
      { key: "parking_sensors", label: "Установка передних / задних парктроников" },
      { key: "audio_upgrade", label: "Установка / апгрейд автомобильной акустики" },
      { key: "battery_replacement", label: "Замена аккумуляторной батареи" },
    ],
  },
  {
    id: "protection",
    title: "🛡 Защита кузова и стёкол",
    options: [
      { key: "ppf", label: "Оклейка кузова антигравийной плёнкой (PPF)" },
      { key: "glass_tint_film", label: "Тонировка и защитная плёнка на стёкла" },
      { key: "body_wrap_film", label: "Оклейка кузова плёнкой" },
    ],
  },
  {
    id: "repair",
    title: "🔧 Ремонт, рихтовка и колёса",
    options: [
      { key: "wheel_repair", label: "Рихтовка и ремонт колёсных дисков" },
      { key: "wheel_alignment", label: "Развал-схождение" },
      { key: "polish_wax", label: "Полировка кузова / нанесение защитного воска" },
      { key: "local_paint", label: "Локальная покраска (удаление царапин, сколов)" },
      {
        key: "body_pdr",
        label: "Рихтовка кузова (выправление вмятин без покраски / с покраской)",
      },
      {
        key: "soundproofing",
        label: "Полная шумоизоляция автомобиля (двери, пол, крыша, арки)",
      },
    ],
  },
  {
    id: "diagnostics",
    title: "🩺 Диагностика и обслуживание",
    options: [
      { key: "presale_prep", label: "Полная предпродажная подготовка автомобиля" },
      { key: "interior_detailing", label: "Глубокая химчистка и реставрация салона" },
      {
        key: "ac_disinfection",
        label: "Очистка и дезинфекция системы кондиционирования",
      },
    ],
  },
  {
    id: "fluids",
    title: "🧴 Замена технических жидкостей и расходников",
    options: [
      { key: "engine_oil", label: "Замена моторного масла и масляного фильтра" },
      { key: "air_filter", label: "Замена воздушного фильтра" },
      { key: "cabin_filter", label: "Замена салонного фильтра (фильтра печки)" },
      { key: "brake_pads", label: "Замена тормозных колодок / дисков" },
      { key: "spark_plugs", label: "Замена свечей зажигания" },
      { key: "coolant", label: "Замена охлаждающей жидкости (антифриза)" },
      { key: "transmission_oil", label: "Замена масла в АКПП / МКПП" },
    ],
  },
];

const OPTION_KEYS = new Set(
  ADDITIONAL_OPTION_GROUPS.flatMap((group) => group.options.map((option) => option.key)),
);

const OPTION_LABELS = new Map(
  ADDITIONAL_OPTION_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.key, option.label] as const),
  ),
);

export function isValidAdditionalOptionKey(key: string): boolean {
  return OPTION_KEYS.has(key);
}

export function getAdditionalOptionLabel(key: string): string {
  return OPTION_LABELS.get(key) ?? key;
}
