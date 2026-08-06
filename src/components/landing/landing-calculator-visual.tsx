/** CSS mock: calculator + commercial proposal preview. */

export function LandingCalculatorVisual() {
  return (
    <div className="w-full" aria-hidden>
      <div className="overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--landing-line)] px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-[var(--landing-ink)]">Калькулятор растаможки</p>
          <div className="flex gap-1.5">
            {["Китай", "Корея", "Киргизия"].map((country, i) => (
              <span
                key={country}
                className={`px-2.5 py-1 text-[11px] font-semibold ${
                  i === 1
                    ? "bg-[var(--landing-brand)] text-white"
                    : "bg-[var(--landing-wash)] text-[var(--landing-muted)]"
                }`}
              >
                {country}
              </span>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="border-b border-[var(--landing-line)] p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Быстрый поиск · ИИ · информация про авто
            </p>
            <div className="mt-3 flex gap-2 border border-[var(--landing-line)] bg-[var(--landing-wash)]/80 px-3 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                Поиск
              </span>
              <span className="text-xs text-[var(--landing-ink)]">Hyundai Tucson 2021 2.0 бензин…</span>
            </div>
            <div className="mt-3 space-y-2 border border-[var(--landing-line)] bg-[var(--landing-wash)]/40 p-3">
              <p className="text-[11px] font-medium text-[var(--landing-muted)]">Найдено</p>
              <p className="text-xs leading-relaxed text-[var(--landing-ink)]">
                Tucson · 2021 · 1999 см³ · 150 л.с. · бензин · ориентир мощности для утильсбора
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { label: "Цена авто", value: "18 500 $" },
                { label: "Возраст", value: "3–5 лет" },
                { label: "Объём", value: "2.0 л" },
                { label: "Мощность", value: "150 л.с." },
              ].map((field) => (
                <div key={field.label} className="border border-[var(--landing-line)] px-3 py-2">
                  <p className="text-[10px] text-[var(--landing-muted)]">{field.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--landing-ink)]">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--landing-surface)]/60 p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Коммерческое предложение
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--landing-ink)]">
              Hyundai Tucson · для Иванова А.
            </p>
            <ul className="mt-4 space-y-2.5">
              {(
                [
                  { label: "Стоимость авто", value: "1 720 000 ₽" },
                  { label: "Таможня и утиль", value: "486 000 ₽" },
                  { label: "Доставка и расходы", value: "198 000 ₽" },
                  { label: "Итого клиенту", value: "2 404 000 ₽", total: true as const },
                ] as const
              ).map((row) => {
                const isTotal = "total" in row && row.total;
                return (
                  <li
                    key={row.label}
                    className={`flex items-center justify-between gap-3 border-b border-[var(--landing-line)] pb-2 ${
                      isTotal ? "border-b-0 pt-1" : ""
                    }`}
                  >
                    <span
                      className={`text-xs ${isTotal ? "font-semibold text-[var(--landing-ink)]" : "text-[var(--landing-muted)]"}`}
                    >
                      {row.label}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        isTotal ? "text-[var(--landing-brand-deep)]" : "text-[var(--landing-ink)]"
                      }`}
                    >
                      {row.value}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="bg-[var(--landing-brand)] px-3 py-2 text-[11px] font-semibold text-white">
                Сохранить в сделку
              </span>
              <span className="border border-[var(--landing-line)] bg-white px-3 py-2 text-[11px] font-medium text-[var(--landing-muted)]">
                Скачать КП
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
