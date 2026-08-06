"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppIconMark } from "@/components/brand/app-icon-mark";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import styles from "@/components/landing/landing.module.css";

const TELEGRAM_URL = "https://t.me/pavsem";
const PHONE_DISPLAY = "+7 905 302-44-99";
const PHONE_HREF = "tel:+79053024499";

const FEATURES = [
  {
    title: "Сделки на канбане",
    text: "Весь импорт в одном потоке: от лида до выдачи. Этапы, приоритеты и менеджеры — без таблиц в Excel.",
  },
  {
    title: "Калькулятор растаможки",
    text: "Считайте пошлины и расходы прямо в CRM. Сохраняйте расчёт в карточку сделки.",
  },
  {
    title: "Кабинет клиента",
    text: "Клиент видит статус своей машины и документы — меньше звонков «ну что там?»",
  },
  {
    title: "Telegram и команда",
    text: "Уведомления в Telegram, роли сотрудников и несколько компаний на одной платформе.",
  },
] as const;

const STEPS = [
  { n: "01", title: "Создаёте сделку", text: "Клиент, VIN, маршрут и менеджер — в одной карточке." },
  { n: "02", title: "Ведете по этапам", text: "Поиск, оплата, таможня, доставка — канбан показывает, где машина." },
  { n: "03", title: "Клиент смотрит прогресс", text: "Личный кабинет и сообщения по стадии без ручной переписки." },
  { n: "04", title: "Считаете и закрываете", text: "Калькулятор, расходы и документы остаются в сделке." },
] as const;

const AUDIENCE = [
  "Импортёры автомобилей",
  "Таможенные брокеры и агенты",
  "Команды с несколькими менеджерами",
] as const;

function useInView<T extends HTMLElement>(margin = "0px 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);

  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${visible ? styles.revealIn : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : undefined }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className={styles.landingRoot}>
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/landing" className="flex items-center gap-3 no-underline">
          <AppIconMark size={36} />
          <span
            className={`${styles.fontDisplay} text-lg font-semibold tracking-tight text-[var(--landing-ink)] sm:text-xl`}
          >
            ImportCRM
          </span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--landing-ink)] underline-offset-4 hover:text-[var(--landing-brand-deep)] hover:underline"
        >
          Войти
        </Link>
      </header>

      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
          <p
            className={`${styles.heroAnim} ${styles.fontDisplay} text-[clamp(2.75rem,9vw,5.5rem)] font-semibold leading-[0.95] tracking-tight text-[var(--landing-ink)]`}
          >
            ImportCRM
          </p>
          <p
            className={`${styles.heroAnim} ${styles.heroAnimD1} mt-3 max-w-xl text-base text-[var(--landing-muted)] sm:text-lg`}
          >
            CRM для импорта автомобилей
          </p>
          <h1
            className={`${styles.heroAnim} ${styles.heroAnimD2} ${styles.fontDisplay} mt-8 max-w-2xl text-[clamp(1.65rem,4.2vw,2.75rem)] font-semibold leading-[1.15] tracking-tight`}
          >
            Ведите поставки авто в одной системе — от заявки до выдачи
          </h1>
          <p
            className={`${styles.heroAnim} ${styles.heroAnimD3} mt-4 max-w-lg text-base leading-relaxed text-[var(--landing-muted)] sm:text-lg`}
          >
            Канбан сделок, калькулятор растаможки и кабинет клиента — чтобы команда и клиент всегда
            видели, где машина.
          </p>
          <div
            className={`${styles.heroAnim} ${styles.heroAnimD4} mt-8 flex flex-wrap items-center gap-3 sm:gap-4`}
          >
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center bg-[var(--landing-brand)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--landing-brand-deep)]"
            >
              Написать в Telegram
            </a>
            <a
              href={PHONE_HREF}
              className="inline-flex h-11 items-center justify-center border border-[var(--landing-ink)]/20 bg-white/70 px-5 text-sm font-semibold text-[var(--landing-ink)] backdrop-blur-sm transition-colors hover:border-[var(--landing-brand)] hover:text-[var(--landing-brand-deep)]"
            >
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>

        <div className={`${styles.heroAnim} ${styles.heroAnimD4} relative w-full`}>
          <LandingHeroVisual />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
            Что умеет ImportCRM
          </h2>
          <p className="mt-3 max-w-xl text-[var(--landing-muted)]">
            Всё, что нужно компании для импорта — без зоопарка чатов и таблиц.
          </p>
        </Reveal>
        <div className="mt-14 space-y-0 divide-y divide-[var(--landing-line)] border-y border-[var(--landing-line)]">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delayMs={i * 70}>
              <div className="grid gap-3 py-8 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] sm:gap-10 sm:py-10">
                <h3 className={`${styles.fontDisplay} text-xl font-semibold tracking-tight sm:text-2xl`}>
                  {feature.title}
                </h3>
                <p className="text-base leading-relaxed text-[var(--landing-muted)] sm:pt-1">
                  {feature.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--landing-line)] bg-[var(--landing-surface)]/80">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Как это работает
            </h2>
            <p className="mt-3 max-w-xl text-[var(--landing-muted)]">
              Четыре шага от первой заявки до закрытой сделки.
            </p>
          </Reveal>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delayMs={i * 80}>
                <li className="list-none">
                  <p
                    className={`${styles.fontDisplay} text-sm font-semibold tracking-widest text-[var(--landing-brand)]`}
                  >
                    {step.n}
                  </p>
                  <h3 className={`${styles.fontDisplay} mt-3 text-lg font-semibold tracking-tight`}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{step.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
            Для кого
          </h2>
          <p className="mt-3 max-w-xl text-[var(--landing-muted)]">
            Если вы возите машины и ведёте клиентов — ImportCRM собирает процесс в одном месте.
          </p>
        </Reveal>
        <ul className="mt-12 space-y-5">
          {AUDIENCE.map((item, i) => (
            <Reveal key={item} delayMs={i * 60}>
              <li className="flex items-baseline gap-4 border-b border-[var(--landing-line)] pb-5 text-xl font-medium tracking-tight sm:text-2xl">
                <span className="mt-2 h-2 w-2 shrink-0 bg-[var(--landing-brand)]" aria-hidden />
                {item}
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="border-t border-[var(--landing-line)] bg-[var(--landing-ink)] text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Готовы посмотреть ImportCRM?
            </h2>
            <p className="mt-4 max-w-lg text-base text-white/70">
              Напишите в Telegram или позвоните — расскажем, как подключить вашу компанию.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center bg-[var(--landing-brand)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--landing-brand-deep)]"
              >
                @pavsem в Telegram
              </a>
              <a
                href={PHONE_HREF}
                className="inline-flex h-11 items-center justify-center border border-white/25 px-5 text-sm font-semibold text-white transition-colors hover:border-white/60"
              >
                {PHONE_DISPLAY}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--landing-line)] bg-[var(--landing-wash)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[var(--landing-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className={`${styles.fontDisplay} font-medium text-[var(--landing-ink)]`}>ImportCRM</p>
          <p>CRM для импорта автомобилей</p>
          <Link href="/login" className="hover:text-[var(--landing-brand-deep)] hover:underline">
            Вход в систему
          </Link>
        </div>
      </footer>
    </div>
  );
}
