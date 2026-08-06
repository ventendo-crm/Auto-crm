import Image from "next/image";

/** Real screenshot of Telegram notifications to the client. */

export function LandingTelegramVisual() {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-[320px] overflow-hidden border border-[var(--landing-line)] bg-[#0e1621] shadow-[0_20px_60px_rgba(22,24,29,0.12)] sm:max-w-[360px]">
        <Image
          src="/landing/telegram-example.png"
          alt="Пример уведомлений ImportCRM в Telegram: маршрут автовоза, фото с точки и ЭПТС"
          width={720}
          height={1280}
          className="h-auto w-full"
          sizes="(max-width: 640px) 90vw, 360px"
          priority={false}
        />
      </div>
    </div>
  );
}
