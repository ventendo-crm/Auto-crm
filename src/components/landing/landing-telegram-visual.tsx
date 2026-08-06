/** CSS mock: Telegram notifications to the client. */

const MESSAGES = [
  {
    title: "Этап обновлён",
    body: "Ваша сделка перешла на этап «Таможня». Менеджер прикрепил расчёт.",
    time: "10:24",
  },
  {
    title: "Автовоз в пути",
    body: "Точка маршрута: Чита. Ожидаемое прибытие в Москву — по графику.",
    time: "14:02",
  },
  {
    title: "ПТС готов",
    body: "Готовый ПТС отправлен вам лично. Проверьте документы в кабинете.",
    time: "вчера",
  },
] as const;

export function LandingTelegramVisual() {
  return (
    <div className="w-full" aria-hidden>
      <div className="mx-auto max-w-md overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: "linear-gradient(135deg, #2aabee 0%, #229ed9 100%)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center bg-white/20 text-sm font-bold text-white">
            IC
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ImportCRM · уведомления</p>
            <p className="text-[11px] text-white/80">бот вашей компании</p>
          </div>
        </div>

        <div
          className="space-y-3 p-4"
          style={{
            background:
              "linear-gradient(180deg, #dce8f2 0%, #e8eef4 40%, #d4e0ec 100%)",
          }}
        >
          {MESSAGES.map((msg) => (
            <div
              key={msg.title}
              className="max-w-[92%] border border-black/5 bg-white px-3 py-2.5 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--landing-ink)]">{msg.title}</p>
                <p className="shrink-0 text-[10px] text-[var(--landing-muted)]">{msg.time}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--landing-muted)]">{msg.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
