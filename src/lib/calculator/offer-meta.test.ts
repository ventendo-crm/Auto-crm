import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeOfferFileName, normalizeOfferMeta } from "@/lib/calculator/offer-meta";

describe("calculator offer meta", () => {
  it("reads a v1 single-car offer as one item", () => {
    const normalized = normalizeOfferMeta({
      version: 1,
      companyId: "c1",
      companyName: "Ventendo",
      createdByUserId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-31T00:00:00.000Z",
      description: "Ultra",
      vehicleTitle: "Li L7",
      sourceUrl: "https://example.com/car",
      totalLabel: "3 200 000 ₽",
      photos: ["photo-01.jpg"],
      estimateFile: "estimate.jpg",
    });

    assert.equal(normalized.version, 2);
    assert.equal(normalized.selectionTitle, "Li L7");
    assert.equal(normalized.items.length, 1);
    assert.equal(normalized.items[0]?.vehicleTitle, "Li L7");
    assert.deepEqual(normalized.items[0]?.photos, ["photo-01.jpg"]);
    assert.equal(normalized.items[0]?.estimateFile, "estimate.jpg");
  });

  it("keeps a v2 selection as-is", () => {
    const meta = {
      version: 2 as const,
      companyId: "c1",
      companyName: "Ventendo",
      createdByUserId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-31T00:00:00.000Z",
      selectionTitle: "Для Ивана",
      items: [
        {
          vehicleTitle: "Li L7",
          description: "Ultra",
          sourceUrl: null,
          totalLabel: "3 200 000 ₽",
          photos: ["i01-photo-01.jpg"],
          estimateFile: "i01-estimate.jpg",
        },
        {
          vehicleTitle: "Li L9",
          description: "",
          sourceUrl: null,
          totalLabel: null,
          photos: ["i02-photo-01.jpg"],
          estimateFile: null,
        },
      ],
    };

    assert.deepEqual(normalizeOfferMeta(meta), meta);
  });

  it("rejects unknown meta", () => {
    assert.throws(() => normalizeOfferMeta({ version: 3 }), /NOT_FOUND/);
  });
});

describe("offer file names", () => {
  it("allows legacy and per-item photo names", () => {
    assert.equal(assertSafeOfferFileName("photo-01.jpg"), "photo-01.jpg");
    assert.equal(assertSafeOfferFileName("estimate.jpg"), "estimate.jpg");
    assert.equal(assertSafeOfferFileName("i01-photo-02.webp"), "i01-photo-02.webp");
    assert.equal(assertSafeOfferFileName("i08-estimate.jpg"), "i08-estimate.jpg");
  });

  it("rejects path traversal", () => {
    assert.throws(() => assertSafeOfferFileName("../secret.jpg"));
    assert.throws(() => assertSafeOfferFileName("i01-photo-01.jpg/../x"));
  });
});
