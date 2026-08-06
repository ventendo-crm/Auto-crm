/** CSS mock of the client personal cabinet — progress, carrier tracking, доп. услуги. */

const STAGES = [
  { label: "Заявка", done: true },
  { label: "Поиск", done: true },
  { label: "Инвойс", done: true },
  { label: "Подготовка", done: true },
  { label: "Таможня", done: true, current: true },
  { label: "В пути", done: false },
  { label: "Получение", done: false },
] as const;

const ROUTE_POINTS = [
  { city: "Владивосток", date: "28 июля", note: "Погрузка на автовоз" },
  { city: "Хабаровск", date: "30 июля", note: "Транзит" },
  { city: "Чита", date: "2 августа", note: "Остановка" },
  { city: "Москва", date: "ожидается", note: "Точка назначения", destination: true },
] as const;

const EXTRA_OPTIONS = [
  { label: "Антикоррозийная обработка", checked: true },
  { label: "Установка ковриков", checked: true },
  { label: "Оклейка PPF", checked: false },
  { label: "Полировка кузова", checked: false },
  { label: "Диагностика ходовой", checked: true },
] as const;

export function LandingClientVisual() {
  return (
    <div className="w-full" aria-hidden>
      <div className="overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-line)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-[var(--landing-muted)]">
              Личный кабинет клиента
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--landing-ink)]">
              Иванов А. · Toyota Camry
            </p>
          </div>
          <span className="shrink-0 bg-[var(--landing-brand)]/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--landing-brand-deep)]">
            Таможня
          </span>
        </div>

        <div className="border-b border-[var(--landing-line)] px-4 py-4 sm:px-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
            Прогресс импорта
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:gap-2">
            {STAGES.map((stage) => {
              const isCurrent = "current" in stage && stage.current;
              return (
                <div key={stage.label} className="min-w-0 flex-1 text-center">
                  <div
                    className="mx-auto h-1.5 w-full"
                    style={{
                      backgroundColor: stage.done || isCurrent ? "hsl(14 100% 55%)" : "#e5e7eb",
                    }}
                  />
                  <p
                    className={`mt-1.5 truncate text-[9px] font-medium sm:text-[10px] ${
                      isCurrent
                        ? "text-[var(--landing-brand-deep)]"
                        : stage.done
                          ? "text-[var(--landing-ink)]"
                          : "text-[var(--landing-muted)]"
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="border-b border-[var(--landing-line)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Доставка · отслеживание автовоза
            </p>
            <div
              className="relative mt-3 h-36 overflow-hidden sm:h-44"
              style={{
                background:
                  "linear-gradient(145deg, #dce8f2 0%, #c5d6e6 40%, #e8eef4 100%)",
              }}
            >
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 180" fill="none">
                <path
                  d="M40 140 C 90 120, 120 80, 170 70 S 260 90, 300 55 S 350 40, 370 35"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.85"
                />
                <path
                  d="M300 55 L 370 35"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="6 5"
                />
                <circle cx="40" cy="140" r="5" fill="#ef4444" />
                <circle cx="170" cy="70" r="4" fill="#ef4444" />
                <circle cx="300" cy="55" r="4" fill="#ef4444" />
                <circle cx="370" cy="35" r="6" fill="#10b981" />
              </svg>
              <p className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 text-[10px] font-medium text-[var(--landing-ink)]">
                Маршрут на карте
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {ROUTE_POINTS.map((point) => (
                <li
                  key={point.city}
                  className={`flex items-start justify-between gap-3 border-l-2 py-1 pl-3 ${
                    point.destination
                      ? "border-emerald-500 bg-emerald-50/80"
                      : "border-[var(--landing-brand)]/50"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-[var(--landing-ink)]">{point.city}</p>
                    <p className="text-[10px] text-[var(--landing-muted)]">{point.note}</p>
                  </div>
                  <p className="shrink-0 text-[10px] text-[var(--landing-muted)]">{point.date}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
                Доп. услуги
              </p>
              <p className="text-[10px] text-[var(--landing-muted)]">выбрано 3</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--landing-muted)]">
              Клиент отмечает нужные опции сам — менеджер видит выбор в сделке.
            </p>
            <ul className="mt-4 space-y-2.5">
              {EXTRA_OPTIONS.map((opt) => (
                <li
                  key={opt.label}
                  className="flex items-center gap-3 border border-[var(--landing-line)] px-3 py-2.5"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] font-bold ${
                      opt.checked
                        ? "border-[var(--landing-brand)] bg-[var(--landing-brand)] text-white"
                        : "border-[var(--landing-line)] bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="text-xs font-medium text-[var(--landing-ink)]">{opt.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
