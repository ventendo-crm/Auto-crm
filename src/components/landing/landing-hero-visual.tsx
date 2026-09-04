/** Full-bleed CSS mock of the product UI — visual anchor for the hero. */

export function LandingHeroVisual() {
  return (
    <div
      className="relative w-full overflow-hidden border-y border-black/10"
      style={{
        background:
          "linear-gradient(160deg, #1c2430 0%, #243044 45%, #2a3548 100%)",
      }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,107,53,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(100,180,220,0.2), transparent 35%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="overflow-hidden rounded-sm border border-white/10 bg-[#12161e]/90 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2 w-2 rounded-sm bg-[#ff6b35]" />
            <span className="h-2 w-2 rounded-sm bg-white/25" />
            <span className="h-2 w-2 rounded-sm bg-white/15" />
            <span className="ml-3 text-[11px] font-medium tracking-wide text-white/50">
              ImportCRM · Клиенты
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4 sm:gap-4 sm:p-5">
            <Column
              title="Лиды"
              accent="#fbbf24"
              cards={[
                { title: "Toyota Camry", meta: "Москва · VIN…4821" },
                { title: "Hyundai Tucson", meta: "СПб · новый" },
              ]}
            />
            <Column
              title="Поиск"
              accent="#38bdf8"
              cards={[
                { title: "BMW X5", meta: "Корея · осмотр" },
                { title: "Kia Sportage", meta: "Китай · торг" },
              ]}
            />
            <Column
              title="Таможня"
              accent="#fb7185"
              cards={[
                { title: "Lexus RX", meta: "Владивосток" },
                { title: "Geely Monjaro", meta: "расчёт готов" },
              ]}
            />
            <Column
              title="Доставка"
              accent="#34d399"
              cards={[
                { title: "Audi Q5", meta: "прибытие 12.08" },
                { title: "Mazda CX-5", meta: "на автовозе" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({
  title,
  accent,
  cards,
}: {
  title: string;
  accent: string;
  cards: Array<{ title: string; meta: string }>;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: accent }} />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/55">
          {title}
        </span>
      </div>
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className="border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm"
          >
            <p className="truncate text-xs font-semibold text-white/90 sm:text-sm">{card.title}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/45 sm:text-[11px]">{card.meta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
