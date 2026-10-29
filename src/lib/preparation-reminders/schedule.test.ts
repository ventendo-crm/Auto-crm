import assert from "node:assert/strict";
import test from "node:test";
import { DealStageType } from "@prisma/client";
import {
  addReminderDays,
  computeStageReminderNextAt,
  isStageReminderDue,
  renderStageReminderMessage,
} from "@/lib/preparation-reminders/message";

const now = new Date("2026-10-29T12:00:00.000Z");

test("новое включение на Таможне планирует срок через выбранные дни", () => {
  const nextAt = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 3,
    stage: DealStageType.CUSTOMS,
    now,
    previous: { enabled: false, intervalDays: 1, nextAt: null },
  });
  assert.equal(nextAt?.toISOString(), addReminderDays(now, 3).toISOString());
});

test("Подготовка и Транспортировка планируются так же", () => {
  for (const stage of [DealStageType.PREPARATION, DealStageType.TRANSPORT]) {
    const nextAt = computeStageReminderNextAt({
      enabled: true,
      intervalDays: 1,
      stage,
      now,
    });
    assert.ok(nextAt);
    assert.equal(isStageReminderDue(nextAt, now), false);
    assert.equal(isStageReminderDue(nextAt, addReminderDays(now, 1)), true);
  }
});

test("на других этапах срок не ставится", () => {
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
        stage,
        now,
        previous: { enabled: true, intervalDays: 1, nextAt: addReminderDays(now, 1) },
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
      stage: DealStageType.CUSTOMS,
      now,
      previous: { enabled: true, intervalDays: 2, nextAt: addReminderDays(now, 2) },
    }),
    null,
  );
});

test("смена периодичности пересчитывает следующий срок", () => {
  const previousNext = addReminderDays(now, 7);
  const nextAt = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 2,
    stage: DealStageType.TRANSPORT,
    now,
    previous: { enabled: true, intervalDays: 7, nextAt: previousNext },
  });
  assert.equal(nextAt?.toISOString(), addReminderDays(now, 2).toISOString());
});

test("повторное сохранение той же периодичности не сдвигает срок", () => {
  const previousNext = addReminderDays(now, 5);
  const nextAt = computeStageReminderNextAt({
    enabled: true,
    intervalDays: 5,
    stage: DealStageType.PREPARATION,
    now,
    previous: { enabled: true, intervalDays: 5, nextAt: previousNext },
  });
  assert.equal(nextAt?.toISOString(), previousNext.toISOString());
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
