"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppIconMark } from "@/components/brand/app-icon-mark";
import { LandingClientVisual } from "@/components/landing/landing-client-visual";
import { LandingDemoCalculator } from "@/components/landing/landing-demo-calculator";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { LandingTelegramVisual } from "@/components/landing/landing-telegram-visual";
import styles from "@/components/landing/landing.module.css";

const TELEGRAM_URL = "https://t.me/pavsem";
const PHONE_DISPLAY = "+7 905 302-44-99";
const PHONE_HREF = "tel:+79053024499";

const FEATURES = [
  {
    title: "Сделки на канбане",
    text: "Весь импорт в одном потоке: от лида до выдачи. Этапы, приоритеты и менеджеры — без таблиц в Excel и без сборки воронок в Битрикс.",
  },
  {
    title: "Калькулятор растаможки",
    text: "Считайте авто из Китая, Кореи и Киргизии. Встроенный быстрый поиск информации про авто на базе ИИ, расчёт можно сразу привязать к карточке клиента.",
  },
  {
    title: "Кабинет клиента",
    text: "Клиент видит прогресс сделки, отслеживает автовоз на карте и сам выбирает доп. услуги — меньше звонков «ну что там?»",
  },
  {
    title: "Telegram и команда",
    text: "Уведомления в Telegram клиенту о всех этапах сделки, отслеживание автовоза и отправка готового ПТС лично клиенту. Плюс роли сотрудников и несколько компаний на одной платформе.",
  },
] as const;

const STEPS = [
  { n: "01", title: "Создаёте сделку", text: "Клиент, VIN, маршрут и менеджер — в одной карточке." },
  { n: "02", title: "Ведете по этапам", text: "Поиск, оплата, таможня, доставка — канбан показывает, где машина." },
  { n: "03", title: "Клиент смотрит прогресс", text: "Личный кабинет и сообщения по стадии без ручной переписки." },
  { n: "04", title: "Считаете и закрываете", text: "Расчёт из калькулятора привязываете к клиенту — вместе с расходами и документами." },
] as const;

const AUDIENCE = [
  "Импортёры автомобилей",
  "Таможенные брокеры и агенты",
  "Команды с несколькими менеджерами",
] as const;

const VS_BITRIX = [
  {
    title: "Готовый процесс, а не конструктор",
    text: "В Битрикс месяцами собирают воронки, поля и виджеты. В ImportCRM канбан импорта уже настроен: от лида до выдачи.",
  },
  {
    title: "Всё связанно, а не модулями",
    text: "Калькулятор, сделка, кабинет клиента, карта автовоза и Telegram работают вместе. Не нужно докупать приложения и склеивать их интегратором.",
  },
  {
    title: "Подключение за день",
    text: "Даём доступ компании и можно сразу вести сделки. Без внедрения «под ключ» и обучения десятку разделов, которые вам не нужны.",
  },
] as const;

const PRICING_INCLUDES = [
  "Канбан сделок и роли сотрудников",
  "Калькулятор растаможки с привязкой к клиенту",
  "Личный кабинет и Telegram",
  "Календарь прибытий",
  "Карта автовоза",
  "Расходы и доп. опции по сделке",
] as const;

const FAQ = [
  {
    q: "Для чего нужна ImportCRM?",
    a: "Компаниям, которые импортируют автомобили: чтобы вести сделки, считать растаможку, показывать клиенту прогресс и не держать процесс в Excel, чатах и Битрикс. Одна система — от заявки до выдачи машины.",
  },
  {
    q: "Чем это проще Битрикса?",
    a: "Битрикс — конструктор: его собирают под вас, часто долго и дорого. ImportCRM сразу заточена под импорт авто. Канбан, калькулятор, кабинет, карта и уведомления уже связаны — без модулей и интегратора.",
  },
  {
    q: "Как работает калькулятор?",
    a: "Считает растаможку для Китая, Кореи и Киргизии: пошлины, утильсбор, расходы по стране. Расчёт можно сохранить в сделку и отдать клиенту как коммерческое предложение. На этой странице — упрощённое демо; в CRM больше полей, шаблоны и курсы компании.",
  },
  {
    q: "Что за календарь?",
    a: "На дашборде — календарь прибытий: даты таможни по сделкам на одном экране. Администратор может выгрузить их в Google Календарь вместе с напоминаниями менеджерам.",
  },
  {
    q: "Как устроена карта с автовозом?",
    a: "Во вкладке «Доставка» отмечаете точки маршрута и город назначения — на карте, с датами и фото. Клиент видит тот же маршрут в личном кабинете и может получать уведомления в Telegram, когда появляется новая точка.",
  },
  {
    q: "Зачем вкладка «Расходы»?",
    a: "Это внутренний учёт затрат по конкретной сделке: строки с описанием и суммой, внизу — итог. Так команда видит маржу. Не путать с калькулятором растаможки — там считается смета клиенту.",
  },
  {
    q: "Что такое доп. опции?",
    a: "Дополнительные услуги: антикор, плёнка, диагностика и другие позиции вашей компании. Клиент отмечает нужное в кабинете, менеджер сразу видит выбор в карточке сделки.",
  },
  {
    q: "Сколько стоит и что входит?",
    a: "5 000 ₽ в месяц за компанию. Входит весь функционал, без доплат за модули. Первые 30 дней — бесплатно: напишите в Telegram или позвоните, подключим доступ.",
  },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/landing" className="flex items-center gap-3 no-underline">
          <AppIconMark size={36} />
          <span
            className={`${styles.fontDisplay} text-lg font-semibold tracking-tight text-[var(--landing-ink)] sm:text-xl`}
          >
            ImportCRM
          </span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <a
            href="#pricing"
            className="text-sm font-medium text-[var(--landing-ink)] underline-offset-4 hover:text-[var(--landing-brand-deep)] hover:underline"
          >
            Цены
          </a>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--landing-ink)] underline-offset-4 hover:text-[var(--landing-brand-deep)] hover:underline"
          >
            Войти
          </Link>
        </nav>
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
            Для компаний, которые импортируют авто
          </p>
          <h1
            className={`${styles.heroAnim} ${styles.heroAnimD2} ${styles.fontDisplay} mt-8 max-w-2xl text-[clamp(1.65rem,4.2vw,2.75rem)] font-semibold leading-[1.15] tracking-tight`}
          >
            Не конструктор вроде Битрикс — готовый процесс импорта
          </h1>
          <p
            className={`${styles.heroAnim} ${styles.heroAnimD3} mt-4 max-w-lg text-base leading-relaxed text-[var(--landing-muted)] sm:text-lg`}
          >
            Канбан, калькулятор растаможки, кабинет клиента и карта автовоза уже внутри. Первые 30
            дней — бесплатно.
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
              Попробовать 30 дней бесплатно
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
            Всё, что нужно компании для импорта — без зоопарка чатов, таблиц и модулей.
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

      <section className="border-y border-[var(--landing-line)] bg-[var(--landing-wash)]/60">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <Reveal>
            <div className="overflow-hidden border border-[var(--landing-line)] bg-white shadow-[0_20px_60px_rgba(22,24,29,0.08)]">
              <Image
                src="/landing/features-overview.png"
                alt="ImportCRM: канбан, калькулятор, КП, поиск с ИИ, кабинет клиента, автовоз, доп. услуги и Telegram"
                width={1920}
                height={1080}
                className="h-auto w-full"
                sizes="(max-width: 1152px) 100vw, 1152px"
                priority={false}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section id="calculator" className="border-y border-[var(--landing-line)] bg-white/50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Посчитайте сами
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--landing-muted)]">
              Упрощённый расчёт прямо здесь. В CRM — полный калькулятор, поиск авто и сохранение сметы
              в сделку клиента.
            </p>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="mt-10">
              <LandingDemoCalculator />
            </div>
          </Reveal>
          <div className="mt-12 space-y-0 divide-y divide-[var(--landing-line)] border-y border-[var(--landing-line)]">
            <Reveal>
              <div className="grid gap-3 py-8 sm:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] sm:gap-10 sm:py-10">
                <h3 className={`${styles.fontDisplay} text-xl font-semibold tracking-tight sm:text-2xl`}>
                  Разные страны
                </h3>
                <p className="text-base leading-relaxed text-[var(--landing-muted)] sm:pt-1">
                  Считайте автомобили из <strong className="font-semibold text-[var(--landing-ink)]">Китая</strong>,{" "}
                  <strong className="font-semibold text-[var(--landing-ink)]">Кореи</strong> и{" "}
                  <strong className="font-semibold text-[var(--landing-ink)]">Киргизии</strong> — с учётом
                  пошлин, утильсбора и расходов по выбранной стране.
                </p>
              </div>
            </Reveal>
            <Reveal delayMs={70}>
              <div className="grid gap-3 py-8 sm:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] sm:gap-10 sm:py-10">
                <h3 className={`${styles.fontDisplay} text-xl font-semibold tracking-tight sm:text-2xl`}>
                  Привязка к клиенту
                </h3>
                <p className="text-base leading-relaxed text-[var(--landing-muted)] sm:pt-1">
                  Готовый расчёт сохраняете в карточку сделки: клиент и менеджер видят одну и ту же
                  смету, без пересылки скринов в мессенджерах.
                </p>
              </div>
            </Reveal>
            <Reveal delayMs={140}>
              <div className="grid gap-3 py-8 sm:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] sm:gap-10 sm:py-10">
                <h3 className={`${styles.fontDisplay} text-xl font-semibold tracking-tight sm:text-2xl`}>
                  Поиск в калькуляторе
                </h3>
                <p className="text-base leading-relaxed text-[var(--landing-muted)] sm:pt-1">
                  Встроенный быстрый поиск на базе искусственного интеллекта подтягивает информацию
                  про авто прямо из калькулятора — характеристики и ориентиры для расчёта утильсбора и
                  пошлин.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
            Личный кабинет клиента
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--landing-muted)]">
            Клиент заходит в свой кабинет и сам видит прогресс сделки: где машина на автовозе и какие
            доп. услуги он выбрал.
          </p>
        </Reveal>
        <Reveal delayMs={100}>
          <div className="mt-10">
            <LandingClientVisual />
          </div>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <Reveal delayMs={120}>
            <h3 className={`${styles.fontDisplay} text-lg font-semibold tracking-tight`}>
              Отслеживание автовоза
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">
              На вкладке «Доставка» — карта маршрута и города по пути. Клиент видит точки и дату
              назначения, без звонков менеджеру.
            </p>
          </Reveal>
          <Reveal delayMs={180}>
            <h3 className={`${styles.fontDisplay} text-lg font-semibold tracking-tight`}>
              Выбор доп. услуг
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">
              Антикор, плёнка, диагностика и другое — клиент отмечает нужное галочками. Выбор сразу
              виден в карточке сделки у вашей команды.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[var(--landing-line)] bg-[var(--landing-wash)]/80">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)] lg:gap-16">
            <div>
              <Reveal>
                <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
                  Telegram и команда
                </h2>
                <p className="mt-3 text-[var(--landing-muted)]">
                  Уведомления в Telegram клиенту о всех этапах сделки, отслеживание автовоза и
                  отправка готового ПТС лично клиенту. Роли сотрудников и несколько компаний — на
                  одной платформе.
                </p>
              </Reveal>
            </div>
            <Reveal delayMs={100}>
              <LandingTelegramVisual />
            </Reveal>
          </div>
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

      <section className="border-y border-[var(--landing-line)] bg-white/50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Проще Битрикса. Заточено под импорт
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--landing-muted)]">
              Не платформа «на все случаи», а рабочий контур компании, которая возит автомобили.
            </p>
          </Reveal>
          <div className="mt-14 space-y-0 divide-y divide-[var(--landing-line)] border-y border-[var(--landing-line)]">
            {VS_BITRIX.map((item, i) => (
              <Reveal key={item.title} delayMs={i * 70}>
                <div className="grid gap-3 py-8 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] sm:gap-10 sm:py-10">
                  <h3 className={`${styles.fontDisplay} text-xl font-semibold tracking-tight sm:text-2xl`}>
                    {item.title}
                  </h3>
                  <p className="text-base leading-relaxed text-[var(--landing-muted)] sm:pt-1">
                    {item.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
            Один тариф. Весь функционал
          </h2>
          <p className="mt-3 max-w-xl text-[var(--landing-muted)]">
            Без модулей, пакетов и скрытых доплат. Сначала 30 дней бесплатно, потом — подписка.
          </p>
        </Reveal>
        <Reveal delayMs={80}>
          <div className="mt-12 border-y border-[var(--landing-line)] py-10">
            <p className={`${styles.fontDisplay} text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-none tracking-tight`}>
              5 000 ₽
            </p>
            <p className="mt-3 text-lg text-[var(--landing-muted)]">в месяц за компанию</p>
            <p className="mt-2 text-sm font-medium text-[var(--landing-brand-deep)]">
              30 дней бесплатно
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {PRICING_INCLUDES.map((item) => (
                <li key={item} className="flex items-baseline gap-3 text-base text-[var(--landing-ink)]">
                  <span className="h-1.5 w-1.5 shrink-0 bg-[var(--landing-brand)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex h-11 items-center justify-center bg-[var(--landing-brand)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--landing-brand-deep)]"
            >
              Подключить пробный период
            </a>
          </div>
        </Reveal>
      </section>

      <section id="faq" className="border-y border-[var(--landing-line)] bg-[var(--landing-wash)]/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Частые вопросы
            </h2>
            <p className="mt-3 max-w-xl text-[var(--landing-muted)]">
              Коротко про продукт — без презентации на час.
            </p>
          </Reveal>
          <div className="mt-10 border-y border-[var(--landing-line)]">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delayMs={i * 40}>
                <details className="border-b border-[var(--landing-line)] last:border-b-0">
                  <summary className={styles.faqSummary}>
                    <span className={`${styles.fontDisplay} text-lg font-semibold tracking-tight sm:text-xl`}>
                      {item.q}
                    </span>
                    <span className={styles.faqMark} aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="max-w-3xl pb-6 text-base leading-relaxed text-[var(--landing-muted)]">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--landing-line)] bg-[var(--landing-ink)] text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <Reveal>
            <h2 className={`${styles.fontDisplay} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              30 дней бесплатно — посмотрите сами
            </h2>
            <p className="mt-4 max-w-lg text-base text-white/70">
              Подключим вашу компанию и дадим полный доступ на месяц без оплаты. Напишите в Telegram
              или позвоните.
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
