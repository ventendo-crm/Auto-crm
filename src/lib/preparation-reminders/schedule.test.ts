import assert from "node:assert/strict";
import test from "node:test";
import { DealStageType } from "@prisma/client";
import {
  advanceStageReminderSchedule,
  computeStageReminderNextAt,
  computeTaskReminderNotifyAt,
  formatTaskDueDate,
  isStageReminderDue,
  renderStageReminderMessage,
  renderTaskReminderMessage,
  scheduleStageReminderAt,
} from "@/lib/preparation-reminders/message";

const eveningMoscow = new Date("2026-10-29T19:50:00.000Z");

test("каждые 3 дня в 10:00 по Москве — 1 ноября 10:00", () => {
  const nextAt = scheduleStageReminderAt({
    now: eveningMoscow,
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Moscow",
  });
  assert.equal(nextAt.toISOString(), "2026-11-01T07:00:00.000Z");
});

test("каждый день в 10:00 после этого часа — завтра", () => {
  const nextAt = scheduleStageReminderAt({
    now: eveningMoscow,
    intervalDays: 1,
    sendTime: "10:00",
    timeZone: "Europe/Moscow",
  });
  assert.equal(nextAt.toISOString(), "2026-10-30T07:00:00.000Z");
  assert.equal(isStageReminderDue(nextAt, eveningMoscow), false);
});

test("каждый день, если выбранное время сегодня ещё впереди", () => {
  const nextAt = scheduleStageReminderAt({
    now: eveningMoscow,
    intervalDays: 1,
    sendTime: "23:30",
    timeZone: "Europe/Moscow",
  });
  assert.equal(nextAt.toISOString(), "2026-10-29T20:30:00.000Z");
});

test("то же время в Самаре на час раньше по UTC, чем в Москве", () => {
  const nextAt = scheduleStageReminderAt({
    now: new Date("2026-10-29T18:50:00.000Z"),
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Samara",
  });
  assert.equal(nextAt.toISOString(), "2026-11-01T06:00:00.000Z");
});

test("Подготовка и Транспортировка планируются так же, на других этапах срок не ставится", () => {
  for (const stage of [DealStageType.PREPARATION, DealStageType.TRANSPORT, DealStageType.CUSTOMS]) {
    const nextAt = computeStageReminderNextAt({
      enabled: true,
      intervalDays: 1,
      sendTime: "10:00",
      timeZone: "Europe/Moscow",
      stage,
      now: eveningMoscow,
    });
    assert.equal(nextAt?.toISOString(), "2026-10-30T07:00:00.000Z");
  }

  for (const stage of [
    DealStageType.LEADS,
    DealStageType.SEARCH,
    DealStageType.INVOICE,
    DealStageType.DELIVERY,
  ]) {
    assert.equal(
      computeStageReminderNextAt({
        enabled: true,
        intervalDays: 1,
        sendTime: "10:00",
        timeZone: "Europe/Moscow",
        stage,
        now: eveningMoscow,
      }),
      null,
    );
  }
});

test("выключенные напоминания не планируются", () => {
  assert.equal(
    computeStageReminderNextAt({
      enabled: false,
      intervalDays: 2,
      sendTime: "10:00",
      timeZone: "Europe/Moscow",
      stage: DealStageType.CUSTOMS,
      now: eveningMoscow,
      previous: {
        enabled: true,
        intervalDays: 2,
        sendTime: "10:00",
        timeZone: "Europe/Moscow",
        nextAt: new Date("2026-11-01T07:00:00.000Z"),
      },
    }),
    null,
  );
});

test("смена времени или пояса пересчитывает срок, повторное сохранение — нет", () => {
  const previousNext = new Date("2026-11-01T07:00:00.000Z");
  const same = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Moscow",
    stage: DealStageType.CUSTOMS,
    now: eveningMoscow,
    previous: {
      enabled: true,
      intervalDays: 3,
      sendTime: "10:00",
      timeZone: "Europe/Moscow",
      nextAt: previousNext,
    },
  });
  assert.equal(same?.toISOString(), previousNext.toISOString());

  const moved = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Samara",
    stage: DealStageType.CUSTOMS,
    now: eveningMoscow,
    previous: {
      enabled: true,
      intervalDays: 3,
      sendTime: "10:00",
      timeZone: "Europe/Moscow",
      nextAt: previousNext,
    },
  });
  assert.equal(moved?.toISOString(), "2026-11-01T06:00:00.000Z");
});

test("старый срок не в выбранное время пересчитывается при сохранении", () => {
  const nextAt = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Moscow",
    stage: DealStageType.PREPARATION,
    now: eveningMoscow,
    previous: {
      enabled: true,
      intervalDays: 3,
      sendTime: "10:00",
      timeZone: "Europe/Moscow",
      nextAt: new Date("2026-11-01T19:50:00.000Z"),
    },
  });
  assert.equal(nextAt?.toISOString(), "2026-11-01T07:00:00.000Z");
});

test("после отправки следующий слот в то же местное время", () => {
  const nextAt = advanceStageReminderSchedule({
    scheduledAt: new Date("2026-11-01T07:00:00.000Z"),
    now: new Date("2026-11-01T07:05:00.000Z"),
    intervalDays: 3,
    sendTime: "10:00",
    timeZone: "Europe/Moscow",
  });
  assert.equal(nextAt.toISOString(), "2026-11-04T07:00:00.000Z");
});

test("текст содержит этап, VIN и ссылку на карточку", () => {
  const { plain, html } = renderStageReminderMessage({
    clientName: "Иван Иванов",
    carBrand: "Volkswagen",
    carModel: "Tharu XR",
    stageLabel: "Таможня",
    vin: "WVWZZZ1KZAW123456",
    dealUrl: "https://importcrm.ru/deals/deal-1",
  });
  assert.match(plain, /Иван Иванов/);
  assert.match(plain, /Volkswagen Tharu XR/);
  assert.match(plain, /Текущий этап: Таможня/);
  assert.match(plain, /VIN: WVWZZZ1KZAW123456/);
  assert.match(plain, /https:\/\/importcrm\.ru\/deals\/deal-1/);
  assert.match(html, /<a href="https:\/\/importcrm\.ru\/deals\/deal-1">Открыть карточку клиента<\/a>/);
});

test("без VIN строка VIN не попадает в уведомление", () => {
  const { plain } = renderStageReminderMessage({
    clientName: "Иван Иванов",
    carBrand: "Volkswagen",
    carModel: "Tharu XR",
    stageLabel: "Подготовка",
    vin: "   ",
    dealUrl: "https://importcrm.ru/deals/deal-1",
  });
  assert.equal(plain.includes("VIN"), false);
});

test("задача на 1 ноября в 10:00 по Москве — 07:00 UTC", () => {
  const notifyAt = computeTaskReminderNotifyAt(
    new Date("2026-11-01T00:00:00.000Z"),
    "10:00",
    "Europe/Moscow",
  );
  assert.equal(notifyAt.toISOString(), "2026-11-01T07:00:00.000Z");
  assert.equal(formatTaskDueDate(new Date("2026-11-01T00:00:00.000Z")), "01.11.2026");
});

test("задача в Самаре на час раньше по UTC, чем в Москве", () => {
  const notifyAt = computeTaskReminderNotifyAt(
    new Date("2026-11-01T00:00:00.000Z"),
    "10:00",
    "Europe/Samara",
  );
  assert.equal(notifyAt.toISOString(), "2026-11-01T06:00:00.000Z");
});

test("текст задачи содержит срок, заголовок и ссылку", () => {
  const { plain, html } = renderTaskReminderMessage({
    clientName: "Иван Иванов",
    title: "Позвонить по оплате",
    dueDateLabel: "01.11.2026",
    carBrand: "Volkswagen",
    carModel: "Tharu XR",
    vin: "WVWZZZ1KZAW123456",
    dealUrl: "https://importcrm.ru/deals/deal-1",
  });
  assert.match(plain, /Задача по клиенту: Иван Иванов/);
  assert.match(plain, /Что сделать: Позвонить по оплате/);
  assert.match(plain, /Срок: 01\.11\.2026/);
  assert.match(plain, /VIN: WVWZZZ1KZAW123456/);
  assert.match(html, /<a href="https:\/\/importcrm\.ru\/deals\/deal-1">Открыть карточку клиента<\/a>/);
});
