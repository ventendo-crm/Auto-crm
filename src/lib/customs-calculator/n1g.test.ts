import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCustoms, type CustomsCalculatorInput } from "@/lib/customs-calculator/calculate";
import { DEFAULT_EXCHANGE_RATES, RECYCLING_BASE_COMMERCIAL } from "@/lib/customs-calculator/rates";

const rates = { ...DEFAULT_EXCHANGE_RATES, EUR: 100, USD: 90 };

function n1gInput(overrides: Partial<CustomsCalculatorInput> = {}): CustomsCalculatorInput {
  return {
    originCountry: "china",
    importer: "personal",
    age: "under3",
    engine: "diesel",
    vehicleCategory: "n1g",
    gvwKg: 3000,
    powerHp: 150,
    volumeCc: 2400,
    price: 2_000_000,
    currency: "RUB",
    rates,
    chinaExpensesCny: 0,
    brokerFeeRub: 0,
    deliveryRub: 0,
    escortRub: 0,
    ...overrides,
  };
}

describe("N1G pickup customs", () => {
  it("does not apply passenger preferential recycling for a personal importer", () => {
    const result = calculateCustoms(n1gInput());
    assert.ok(result);
    assert.equal(result.vehicleCategory, "n1g");
    assert.equal(result.recyclingFee, RECYCLING_BASE_COMMERCIAL * 6.6);
    assert.equal(result.excise, 0);
  });

  it("charges diesel duty 10% and VAT even for a physical person", () => {
    const result = calculateCustoms(n1gInput({ price: 1_000_000 }));
    assert.ok(result);
    assert.equal(result.customsDuty, 100_000);
    assert.equal(result.customsDutyNote, "10%");
    assert.equal(result.vat, (1_000_000 + 100_000) * 0.2);
  });

  it("uses 12.5% duty for a new petrol pickup up to 2800 cc", () => {
    const result = calculateCustoms(
      n1gInput({ engine: "petrol", age: "new", volumeCc: 2700, price: 1_000_000 }),
    );
    assert.ok(result);
    assert.equal(result.customsDuty, 125_000);
    assert.equal(result.customsDutyNote, "12.5%");
  });

  it("uses 15% duty for a new petrol pickup over 2800 cc", () => {
    const result = calculateCustoms(
      n1gInput({ engine: "petrol", age: "new", volumeCc: 3500, price: 1_000_000 }),
    );
    assert.ok(result);
    assert.equal(result.customsDuty, 150_000);
  });

  it("uses 1 €/cm³ for pickups older than 7 years", () => {
    const result = calculateCustoms(n1gInput({ age: "over7", volumeCc: 2000, price: 500_000 }));
    assert.ok(result);
    assert.equal(result.customsDuty, 2000 * 1 * rates.EUR);
    assert.equal(result.customsDutyNote, "1 €/см³");
  });

  it("uses the 2027 N1 mass coefficient when asked", () => {
    const result = calculateCustoms(n1gInput({ recyclingFeeYear: "2027", gvwKg: 2400 }));
    assert.ok(result);
    assert.equal(result.recyclingFee, RECYCLING_BASE_COMMERCIAL * 6.74);
  });

  it("uses the up-to-2.5 t band", () => {
    const result = calculateCustoms(n1gInput({ gvwKg: 2500, age: "from3to5" }));
    assert.ok(result);
    assert.equal(result.recyclingFee, RECYCLING_BASE_COMMERCIAL * 8.91);
  });

  it("returns null without a valid GVW", () => {
    assert.equal(calculateCustoms(n1gInput({ gvwKg: 0 })), null);
    assert.equal(calculateCustoms(n1gInput({ gvwKg: 3501 })), null);
    assert.equal(calculateCustoms(n1gInput({ gvwKg: undefined })), null);
  });

  it("keeps M1 personal preferential recycling unchanged", () => {
    const result = calculateCustoms(
      n1gInput({ vehicleCategory: "m1", gvwKg: undefined, engine: "petrol" }),
    );
    assert.ok(result);
    assert.equal(result.vehicleCategory, "m1");
    assert.equal(result.recyclingFee, 3400);
    assert.equal(result.vat, 0);
  });
});
