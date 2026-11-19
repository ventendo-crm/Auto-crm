import assert from "node:assert/strict";
import test from "node:test";
import {
  convertPowerInputValue,
  formatPowerInputValue,
  hpToKw,
  kwToHp,
  powerInputToHp,
} from "@/lib/customs-calculator/rates";

test("кВт и л.с. переводятся туда-обратно без скачка порога льготы", () => {
  const hp = 150;
  const kw = hpToKw(hp);
  assert.ok(Math.abs(kw - 110.3) < 0.05);
  assert.ok(Math.abs(kwToHp(kw) - hp) < 1e-9);
  assert.ok(powerInputToHp(kw, "kw") < 160);
  assert.equal(powerInputToHp(hp, "hp"), hp);
});

test("110 кВт в расчёте — это около 150 л.с.", () => {
  const hp = powerInputToHp(110, "kw");
  assert.ok(hp > 149 && hp < 150);
  assert.equal(formatPowerInputValue(hpToKw(150)), "110.3");
});

test("переключатель поля не меняет физическую мощность", () => {
  const asKw = convertPowerInputValue("150", "hp", "kw");
  assert.equal(asKw, "110.3");
  const back = convertPowerInputValue(asKw, "kw", "hp");
  assert.equal(back, "150");
});

test("пустой и нулевой ввод при смене единиц не трогаем", () => {
  assert.equal(convertPowerInputValue("", "hp", "kw"), "");
  assert.equal(convertPowerInputValue("0", "kw", "hp"), "0");
});
