import {
  CarAge,
  CurrencyCode,
  CUSTOMS_FEE_BRACKETS,
  DEFAULT_KOREA_BROKER_FEE_RUB,
  DEFAULT_KOREA_DELIVERY_RUB,
  DEFAULT_KOREA_DOCS_DELIVERY_KRW,
  DEFAULT_KOREA_PARKING_FEE_KRW,
  DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD,
  DeliveryRoute,
  EngineType,
  EXCISE_BRACKETS,
  ExchangeRates,
  hpToKw,
  ImporterType,
  isChinaLikeOrigin,
  isKoreaOrigin,
  isKyrgyzstanOrigin,
  isYoungerThan3,
  KAZAKHSTAN_DELIVERY_USD,
  OriginCountry,
  PREFERENTIAL_MAX_HP_EV,
  PREFERENTIAL_MAX_HP_ICE,
  PREFERENTIAL_MAX_VOLUME_CC,
  RECYCLING_BASE_PASSENGER,
  VAT_RATE,
} from "@/lib/customs-calculator/rates";

export interface CustomsCalculatorInput {
  originCountry?: OriginCountry;
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: number;
  volumeCc: number;
  price: number;
  /**
   * Опциональная таможенная стоимость (каталог таможни), в той же валюте, что и `price`.
   * Учитывается только для возраста `new`: сбор, пошлина и НДС считаются от неё,
   * а стоимость авто для оплаты (ВТБ и т.п.) остаётся по `price`.
   */
  customsPrice?: number;
  currency: CurrencyCode;
  rates: ExchangeRates;
  /** Расходы по Китаю в юанях (CNY) */
  chinaExpensesCny?: number;
  /** Доставка до города (Киргизия), USD */
  cityDeliveryUsd?: number;
  /** Документы и доставка до РФ (Корея), KRW */
  koreaDocsDeliveryKrw?: number;
  /** Комиссия стоянки (Корея), KRW */
  parkingFeeKrw?: number;
  /** Услуги брокера, ₽ */
  brokerFeeRub?: number;
  /** Маршрут доставки по РФ */
  deliveryRoute?: DeliveryRoute;
  /** Доставка по РФ через Уссурийск / Владивосток, ₽ */
  deliveryRub?: number;
  /** Доставка через Казахстан, USD (по умолчанию 1500) */
  deliveryUsd?: number;
  /** Услуги сопровождения, ₽ */
  escortRub?: number;
  /**
   * Дополнительные расходы компании (шаблон калькулятора).
   * Конвертируются в ₽ и прибавляются к итогу.
   */
  extraExpenses?: Array<{
    id: string;
    label: string;
    amount: number;
    currency: CurrencyCode;
  }>;
}

export interface CustomsCalculatorResult {
  originCountry: OriginCountry;
  priceRub: number;
  priceEur: number;
  /** Таможенная (каталожная) стоимость в ₽, если задана и применена для new. */
  customsPriceRub: number | null;
  customsPriceEur: number | null;
  chinaExpensesCny: number;
  chinaExpensesRub: number;
  cityDeliveryUsd: number;
  cityDeliveryRub: number;
  koreaDocsDeliveryKrw: number;
  koreaDocsDeliveryRub: number;
  parkingFeeKrw: number;
  parkingFeeRub: number;
  /**
   * Китай: (авто + расходы по Китаю) × 1.02
   * Киргизия: (авто + доставка до города) × 1.02
   * Корея: авто + комиссия стоянки + документы/доставка до РФ
   */
  vtbTotalRub: number;
  firstPaymentLabel: string;
  firstPaymentNote: string;
  brokerFeeRub: number;
  customsFee: number;
  customsDuty: number;
  customsDutyNote: string;
  recyclingFee: number;
  recyclingNote: string;
  excise: number;
  vat: number;
  deliveryRoute: DeliveryRoute;
  deliveryRub: number;
  deliveryNote: string;
  escortRub: number;
  extraExpenses: Array<{ id: string; label: string; amountRub: number }>;
  extraExpensesRub: number;
  totalCustoms: number;
  /** Полный итог со всеми расходами */
  totalWithCar: number;
}

export const VTB_COMMISSION_RATE = 0.02;
export const DEFAULT_BROKER_FEE_RUB = 55_000;
export const DEFAULT_DELIVERY_RUB = 200_000;
export const DEFAULT_ESCORT_RUB = 200_000;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toRub(amount: number, currency: CurrencyCode, rates: ExchangeRates): number {
  if (currency === "RUB") return amount;
  return amount * rates[currency];
}

function toEur(amountRub: number, rates: ExchangeRates): number {
  return rates.EUR > 0 ? amountRub / rates.EUR : 0;
}

export function calcCustomsFee(priceRub: number): number {
  const bracket = CUSTOMS_FEE_BRACKETS.find((item) => priceRub <= item.maxRub);
  return bracket?.fee ?? CUSTOMS_FEE_BRACKETS[CUSTOMS_FEE_BRACKETS.length - 1].fee;
}

export function calcExcise(powerHp: number): number {
  const bracket = EXCISE_BRACKETS.find((item) => powerHp <= item.maxHp);
  return powerHp * (bracket?.ratePerHp ?? 0);
}

function maxOfPercentAndEuroPerCc(
  priceEur: number,
  percent: number,
  euroPerCc: number,
  volumeCc: number,
  eurRate: number,
): number {
  const byPercent = priceEur * (percent / 100) * eurRate;
  const byVolume = volumeCc * euroPerCc * eurRate;
  return Math.max(byPercent, byVolume);
}

function individualDutyUnder3(priceEur: number, volumeCc: number, eurRate: number): {
  duty: number;
  note: string;
} {
  const tiers: Array<{ maxEur: number; percent: number; euroPerCc: number }> = [
    { maxEur: 8500, percent: 54, euroPerCc: 2.5 },
    { maxEur: 16700, percent: 48, euroPerCc: 3.5 },
    { maxEur: 42300, percent: 48, euroPerCc: 5.5 },
    { maxEur: 84500, percent: 48, euroPerCc: 7.5 },
    { maxEur: 169000, percent: 48, euroPerCc: 15 },
    { maxEur: Infinity, percent: 48, euroPerCc: 20 },
  ];
  const tier = tiers.find((item) => priceEur <= item.maxEur)!;
  return {
    duty: maxOfPercentAndEuroPerCc(priceEur, tier.percent, tier.euroPerCc, volumeCc, eurRate),
    note: `${tier.percent}%, но не менее ${tier.euroPerCc} €/см³`,
  };
}

function individualDutyOver3(age: CarAge, volumeCc: number, eurRate: number): {
  duty: number;
  note: string;
} {
  const older = age === "from5to7" || age === "over7";
  const bands: Array<{ maxCc: number; young: number; old: number }> = [
    { maxCc: 1000, young: 1.5, old: 3 },
    { maxCc: 1500, young: 1.7, old: 3.2 },
    { maxCc: 1800, young: 2.5, old: 3.5 },
    { maxCc: 2300, young: 2.7, old: 4.8 },
    { maxCc: 3000, young: 3, old: 5 },
    { maxCc: Infinity, young: 3.6, old: 5.7 },
  ];
  const band = bands.find((item) => volumeCc <= item.maxCc)!;
  const euroPerCc = older ? band.old : band.young;
  return {
    duty: volumeCc * euroPerCc * eurRate,
    note: `${euroPerCc} €/см³`,
  };
}

function legalPetrolDuty(
  age: CarAge,
  priceRub: number,
  volumeCc: number,
  eurRate: number,
): { duty: number; note: string } {
  if (isYoungerThan3(age)) {
    const p = volumeCc <= 2800 ? 15 : 12.5;
    return { duty: priceRub * (p / 100), note: `${p}%` };
  }

  if (age === "over7") {
    const bands: Array<{ maxCc: number; rate: number }> = [
      { maxCc: 1000, rate: 1.4 },
      { maxCc: 1500, rate: 1.5 },
      { maxCc: 1800, rate: 1.6 },
      { maxCc: 3000, rate: 2.2 },
      { maxCc: Infinity, rate: 3.2 },
    ];
    const band = bands.find((item) => volumeCc <= item.maxCc)!;
    return { duty: volumeCc * band.rate * eurRate, note: `${band.rate} €/см³` };
  }

  // 3–7 years: 20% but not less than X €/cm³
  const mins: Array<{ maxCc: number; min: number }> = [
    { maxCc: 1000, min: 0.36 },
    { maxCc: 1500, min: 0.4 },
    { maxCc: 1800, min: 0.36 },
    { maxCc: 3000, min: 0.44 },
    { maxCc: Infinity, min: 0.8 },
  ];
  const band = mins.find((item) => volumeCc <= item.maxCc)!;
  const duty = Math.max(priceRub * 0.2, volumeCc * band.min * eurRate);
  return { duty, note: `20%, но не менее ${band.min} €/см³` };
}

function legalDieselDuty(
  age: CarAge,
  priceRub: number,
  volumeCc: number,
  eurRate: number,
): { duty: number; note: string } {
  if (isYoungerThan3(age)) {
    return { duty: priceRub * 0.15, note: "15%" };
  }

  if (age === "over7") {
    const rate = volumeCc <= 1500 ? 1.5 : volumeCc <= 2500 ? 2.2 : 3.2;
    return { duty: volumeCc * rate * eurRate, note: `${rate} €/см³` };
  }

  const min = volumeCc <= 1500 ? 0.32 : volumeCc <= 2500 ? 0.4 : 0.8;
  const duty = Math.max(priceRub * 0.2, volumeCc * min * eurRate);
  return { duty, note: `20%, но не менее ${min} €/см³` };
}

function calcCustomsDuty(input: {
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  volumeCc: number;
  priceRub: number;
  priceEur: number;
  eurRate: number;
}): { duty: number; note: string } {
  const { importer, age, engine, volumeCc, priceRub, priceEur, eurRate } = input;

  if (engine === "electric") {
    return { duty: priceRub * 0.15, note: "15% от стоимости" };
  }

  const useIndividualRates = importer === "personal" || importer === "resale";

  if (useIndividualRates) {
    if (isYoungerThan3(age)) {
      return individualDutyUnder3(priceEur, volumeCc, eurRate);
    }
    return individualDutyOver3(age, volumeCc, eurRate);
  }

  if (engine === "diesel") {
    return legalDieselDuty(age, priceRub, volumeCc, eurRate);
  }

  return legalPetrolDuty(age, priceRub, volumeCc, eurRate);
}

type PowerVolumeCell = number;

function pickCommercialIceCoeff(powerKw: number, volumeCc: number, young: boolean): number {
  // volume columns: <=1000, 1001-2000, 2001-3000, 3001-3500, >3500 — each young/old
  const volumeIndex =
    volumeCc <= 1000 ? 0 : volumeCc <= 2000 ? 1 : volumeCc <= 3000 ? 2 : volumeCc <= 3500 ? 3 : 4;

  const rows: Array<{ maxKw: number; coeffs: [PowerVolumeCell, PowerVolumeCell][] }> = [
    {
      maxKw: 117.68,
      coeffs: [
        [14.88, 27.6],
        [40.04, 70.44],
        [112.52, 170.36],
        [129.2, 197.81],
        [164.53, 219.48],
      ],
    },
    {
      maxKw: 139.75,
      coeffs: [
        [15.36, 28.43],
        [45, 74.64],
        [115.34, 172.8],
        [131.76, 200.04],
        [167.28, 222.84],
      ],
    },
    {
      maxKw: 161.81,
      coeffs: [
        [15.84, 29.28],
        [47.64, 79.2],
        [118.2, 175.08],
        [134.4, 202.2],
        [170.16, 226.2],
      ],
    },
    {
      maxKw: 183.88,
      coeffs: [
        [16.2, 30.12],
        [50.52, 83.88],
        [120.12, 177.6],
        [137.16, 204.36],
        [173.04, 231.36],
      ],
    },
    {
      maxKw: 205.94,
      coeffs: [
        [17.28, 30.12],
        [57.12, 91.92],
        [126.0, 183.0],
        [140.52, 207.24],
        [176.52, 236.64],
      ],
    },
    {
      maxKw: 228.0,
      coeffs: [
        [17.28, 30.12],
        [64.56, 100.56],
        [131.04, 188.52],
        [144.0, 212.4],
        [180, 249.6],
      ],
    },
    {
      maxKw: 250.07,
      coeffs: [
        [17.28, 30.12],
        [72.96, 110.16],
        [136.32, 193.68],
        [151.92, 217.8],
        [186.36, 263.4],
      ],
    },
    {
      maxKw: 272.13,
      coeffs: [
        [17.28, 30.12],
        [83.16, 120.6],
        [141.72, 199.08],
        [160.32, 224.28],
        [192.88, 277.92],
      ],
    },
    {
      maxKw: 294.2,
      coeffs: [
        [17.28, 30.12],
        [94.8, 132.0],
        [147.48, 204.72],
        [169.2, 231],
        [199.68, 293.16],
      ],
    },
    {
      maxKw: 316.26,
      coeffs: [
        [17.28, 30.12],
        [108, 144.6],
        [153.36, 210.48],
        [178.44, 237.96],
        [206.64, 309.36],
      ],
    },
    {
      maxKw: 338.33,
      coeffs: [
        [17.28, 30.12],
        [123.24, 158.4],
        [159.48, 216.36],
        [188.28, 245.04],
        [213.84, 326.4],
      ],
    },
    {
      maxKw: 367.75,
      coeffs: [
        [17.28, 30.12],
        [140.4, 173.4],
        [165.84, 222.36],
        [198.6, 252.48],
        [221.28, 344.28],
      ],
    },
    {
      maxKw: Infinity,
      coeffs: [
        [17.28, 30.12],
        [160.08, 189.84],
        [172.44, 228.6],
        [209.52, 260.04],
        // В таблице ncimport для >3500 / >367.75 указано 219,48 (вероятно опечатка).
        [229.08, 219.48],
      ],
    },
  ];

  const row = rows.find((item) => powerKw <= item.maxKw)!;
  const pair = row.coeffs[volumeIndex];
  return young ? pair[0] : pair[1];
}

function pickCommercialEvCoeff(powerKw: number, young: boolean): number {
  const rows: Array<{ maxKw: number; young: number; old: number }> = [
    { maxKw: 58.84, young: 40.04, old: 70.44 },
    { maxKw: 73.55, young: 49.56, old: 82.08 },
    { maxKw: 95.61, young: 65.88, old: 95.64 },
    { maxKw: 117.68, young: 78.0, old: 111.36 },
    { maxKw: 139.75, young: 92.4, old: 129.72 },
    { maxKw: 161.81, young: 109.68, old: 151.2 },
    { maxKw: 183.88, young: 129.96, old: 176.16 },
    { maxKw: 205.94, young: 153.96, old: 205.2 },
    { maxKw: Infinity, young: 182.4, old: 239.04 },
  ];
  const row = rows.find((item) => powerKw <= item.maxKw)!;
  return young ? row.young : row.old;
}

function calcRecyclingFee(input: {
  importer: ImporterType;
  age: CarAge;
  engine: EngineType;
  powerHp: number;
  volumeCc: number;
}): { fee: number; note: string } {
  const { importer, age, engine, powerHp, volumeCc } = input;
  const powerKw = hpToKw(powerHp);
  const young = isYoungerThan3(age);
  const personal = importer === "personal";

  // Льготный УС для физлица (личное пользование): база 20 000 × 0.17/0.26.
  // Условия: ДВС ≤160 л.с. и ≤3000 см³, либо электро ≤80 л.с. (30-мин. мощность).
  if (personal) {
    if (engine === "electric") {
      if (powerHp <= PREFERENTIAL_MAX_HP_EV) {
        const k = young ? 0.17 : 0.26;
        return {
          fee: RECYCLING_BASE_PASSENGER * k,
          note: `Льготный УС: ${RECYCLING_BASE_PASSENGER.toLocaleString("ru-RU")} × ${k}`,
        };
      }
    } else if (volumeCc <= PREFERENTIAL_MAX_VOLUME_CC && powerHp <= PREFERENTIAL_MAX_HP_ICE) {
      const k = young ? 0.17 : 0.26;
      return {
        fee: RECYCLING_BASE_PASSENGER * k,
        note: `Льготный УС: ${RECYCLING_BASE_PASSENGER.toLocaleString("ru-RU")} × ${k}`,
      };
    }
  }

  // Коммерческий УС для легковых (в т.ч. >160 л.с. для физлица, перепродажа, юрлицо):
  // база тоже 20 000 руб. (150 000 — для грузовых/автобусов, не для M1).
  const coeff =
    engine === "electric"
      ? pickCommercialEvCoeff(powerKw, young)
      : pickCommercialIceCoeff(powerKw, volumeCc, young);

  return {
    fee: RECYCLING_BASE_PASSENGER * coeff,
    note: `Коммерческий УС: ${RECYCLING_BASE_PASSENGER.toLocaleString("ru-RU")} × ${coeff}`,
  };
}

export function calculateCustoms(input: CustomsCalculatorInput): CustomsCalculatorResult | null {
  if (
    !Number.isFinite(input.price) ||
    input.price <= 0 ||
    !Number.isFinite(input.powerHp) ||
    input.powerHp <= 0
  ) {
    return null;
  }

  if (input.engine !== "electric" && (!Number.isFinite(input.volumeCc) || input.volumeCc <= 0)) {
    return null;
  }

  const priceRub = toRub(input.price, input.currency, input.rates);
  const priceEur = toEur(priceRub, input.rates);
  const eurRate = input.rates.EUR;

  const useCustomsCatalog =
    input.age === "new" &&
    Number.isFinite(input.customsPrice) &&
    (input.customsPrice as number) > 0;
  const customsPriceRub = useCustomsCatalog
    ? toRub(input.customsPrice as number, input.currency, input.rates)
    : null;
  const customsBaseRub = customsPriceRub ?? priceRub;
  const customsBaseEur = toEur(customsBaseRub, input.rates);
  const customsPriceEur = useCustomsCatalog ? customsBaseEur : null;

  const originCountry: OriginCountry = input.originCountry?.trim() || "china";
  const skipFullCustoms = isKyrgyzstanOrigin(originCountry);

  const customsFee = skipFullCustoms ? 0 : calcCustomsFee(customsBaseRub);
  const dutyResult = skipFullCustoms
    ? { duty: 0, note: "" }
    : calcCustomsDuty({
        importer: input.importer,
        age: input.age,
        engine: input.engine,
        volumeCc: input.engine === "electric" ? 0 : input.volumeCc,
        priceRub: customsBaseRub,
        priceEur: customsBaseEur,
        eurRate,
      });
  const customsDuty = dutyResult.duty;
  const customsDutyNote = dutyResult.note;

  const paysExciseAndVatIce = input.importer === "legal";
  const paysExciseAndVatEv = true;
  const paysExciseAndVat =
    !skipFullCustoms &&
    (input.engine === "electric" ? paysExciseAndVatEv : paysExciseAndVatIce);

  const excise = paysExciseAndVat ? calcExcise(input.powerHp) : 0;
  const vat = paysExciseAndVat ? (customsBaseRub + customsDuty + excise) * VAT_RATE : 0;

  const { fee: recyclingFee, note: recyclingNote } = calcRecyclingFee({
    importer: input.importer,
    age: input.age,
    engine: input.engine,
    powerHp: input.powerHp,
    volumeCc: input.engine === "electric" ? 0 : input.volumeCc,
  });

  const totalCustoms = skipFullCustoms
    ? recyclingFee
    : customsFee + customsDuty + excise + vat + recyclingFee;

  const chinaExpensesCny =
    isChinaLikeOrigin(originCountry) &&
    Number.isFinite(input.chinaExpensesCny) &&
    (input.chinaExpensesCny ?? 0) > 0
      ? (input.chinaExpensesCny as number)
      : 0;
  const chinaExpensesRub = toRub(chinaExpensesCny, "CNY", input.rates);

  const cityDeliveryUsd =
    isKyrgyzstanOrigin(originCountry)
      ? normalizeOptionalRub(input.cityDeliveryUsd, DEFAULT_KYRGYZSTAN_CITY_DELIVERY_USD)
      : 0;
  const cityDeliveryRub = toRub(cityDeliveryUsd, "USD", input.rates);

  const koreaDocsDeliveryKrw =
    isKoreaOrigin(originCountry)
      ? normalizeOptionalRub(input.koreaDocsDeliveryKrw, DEFAULT_KOREA_DOCS_DELIVERY_KRW)
      : 0;
  const koreaDocsDeliveryRub = toRub(koreaDocsDeliveryKrw, "KRW", input.rates);

  const parkingFeeKrw =
    isKoreaOrigin(originCountry)
      ? normalizeOptionalRub(input.parkingFeeKrw, DEFAULT_KOREA_PARKING_FEE_KRW)
      : 0;
  const parkingFeeRub = toRub(parkingFeeKrw, "KRW", input.rates);

  let vtbTotalRub: number;
  let firstPaymentLabel: string;
  let firstPaymentNote: string;
  if (isKoreaOrigin(originCountry)) {
    vtbTotalRub = priceRub + parkingFeeRub + koreaDocsDeliveryRub;
    firstPaymentLabel = "Первый платёж по инвойсу";
    firstPaymentNote = "Авто + комиссия стоянки + документы и доставка до РФ";
  } else if (isKyrgyzstanOrigin(originCountry)) {
    vtbTotalRub = (priceRub + cityDeliveryRub) * (1 + VTB_COMMISSION_RATE);
    firstPaymentLabel = "Итог с комиссией ВТБ";
    firstPaymentNote = "Авто + доставка до города + 2%";
  } else {
    vtbTotalRub = (priceRub + chinaExpensesRub) * (1 + VTB_COMMISSION_RATE);
    firstPaymentLabel = "Итог с комиссией ВТБ";
    firstPaymentNote = "Авто + расходы по стране + 2%";
  }

  const brokerFeeRub = normalizeOptionalRub(
    input.brokerFeeRub,
    isKoreaOrigin(originCountry) ? DEFAULT_KOREA_BROKER_FEE_RUB : DEFAULT_BROKER_FEE_RUB,
  );

  let deliveryRoute: DeliveryRoute;
  let deliveryRub: number;
  let deliveryNote: string;
  if (isKoreaOrigin(originCountry)) {
    deliveryRoute = "vladivostok";
    deliveryRub = normalizeOptionalRub(input.deliveryRub, DEFAULT_KOREA_DELIVERY_RUB);
    deliveryNote = "из Владивостока";
  } else if (isKyrgyzstanOrigin(originCountry)) {
    // Для Киргизии доставка только «до города» (USD) в первом платеже ВТБ.
    deliveryRoute = "ussuriysk";
    deliveryRub = 0;
    deliveryNote = "";
  } else {
    deliveryRoute = input.deliveryRoute === "kazakhstan" ? "kazakhstan" : "ussuriysk";
    const resolved = resolveDelivery(
      deliveryRoute,
      input.deliveryRub,
      input.deliveryUsd,
      input.rates,
    );
    deliveryRub = resolved.amount;
    deliveryNote = resolved.note;
  }

  const escortRub = normalizeOptionalRub(input.escortRub, DEFAULT_ESCORT_RUB);

  const extraExpenses = (input.extraExpenses ?? [])
    .filter((item) => item.label.trim() && Number.isFinite(item.amount) && item.amount > 0)
    .map((item) => ({
      id: item.id,
      label: item.label.trim(),
      amountRub: roundMoney(toRub(item.amount, item.currency, input.rates)),
    }));
  const extraExpensesRub = roundMoney(
    extraExpenses.reduce((sum, item) => sum + item.amountRub, 0),
  );

  const totalWithCar =
    vtbTotalRub + brokerFeeRub + totalCustoms + deliveryRub + escortRub + extraExpensesRub;

  return {
    originCountry,
    priceRub: roundMoney(priceRub),
    priceEur: roundMoney(priceEur),
    customsPriceRub: customsPriceRub != null ? roundMoney(customsPriceRub) : null,
    customsPriceEur: customsPriceEur != null ? roundMoney(customsPriceEur) : null,
    chinaExpensesCny: roundMoney(chinaExpensesCny),
    chinaExpensesRub: roundMoney(chinaExpensesRub),
    cityDeliveryUsd: roundMoney(cityDeliveryUsd),
    cityDeliveryRub: roundMoney(cityDeliveryRub),
    koreaDocsDeliveryKrw: roundMoney(koreaDocsDeliveryKrw),
    koreaDocsDeliveryRub: roundMoney(koreaDocsDeliveryRub),
    parkingFeeKrw: roundMoney(parkingFeeKrw),
    parkingFeeRub: roundMoney(parkingFeeRub),
    vtbTotalRub: roundMoney(vtbTotalRub),
    firstPaymentLabel,
    firstPaymentNote,
    brokerFeeRub: roundMoney(brokerFeeRub),
    customsFee: roundMoney(customsFee),
    customsDuty: roundMoney(customsDuty),
    customsDutyNote,
    recyclingFee: roundMoney(recyclingFee),
    recyclingNote,
    excise: roundMoney(excise),
    vat: roundMoney(vat),
    deliveryRoute,
    deliveryRub: roundMoney(deliveryRub),
    deliveryNote,
    escortRub: roundMoney(escortRub),
    extraExpenses,
    extraExpensesRub,
    totalCustoms: roundMoney(totalCustoms),
    totalWithCar: roundMoney(totalWithCar),
  };
}

function resolveDelivery(
  route: DeliveryRoute,
  deliveryRub: number | undefined,
  deliveryUsd: number | undefined,
  rates: ExchangeRates,
): { amount: number; note: string } {
  if (route === "kazakhstan") {
    const usd =
      Number.isFinite(deliveryUsd) && (deliveryUsd as number) >= 0
        ? (deliveryUsd as number)
        : KAZAKHSTAN_DELIVERY_USD;
    return {
      amount: usd * rates.USD,
      note: `через Казахстан · ${usd.toLocaleString("ru-RU", {
        maximumFractionDigits: 2,
      })} USD`,
    };
  }

  return {
    amount: normalizeOptionalRub(deliveryRub, DEFAULT_DELIVERY_RUB),
    note: "через Уссурийск",
  };
}

function normalizeOptionalRub(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}
