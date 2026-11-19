import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOfferLinkCaption,
  buildSelectionLinkCaption,
  DEFAULT_OFFER_LINK_CAPTION_TEMPLATE,
  formatOfferMileageInput,
  formatOfferMileageKm,
  parseOfferMileageKm,
} from "@/lib/calculator/offer-share";

describe("offer link captions", () => {
  it("keeps the company template for a single car", () => {
    assert.equal(
      buildSelectionLinkCaption({
        selectionTitle: "",
        itemCount: 1,
        firstVehicleTitle: "Li L7",
        template: DEFAULT_OFFER_LINK_CAPTION_TEMPLATE,
      }),
      buildOfferLinkCaption("Li L7", DEFAULT_OFFER_LINK_CAPTION_TEMPLATE),
    );
  });

  it("uses the selection title when several cars are shared", () => {
    assert.equal(
      buildSelectionLinkCaption({
        selectionTitle: "Для Ивана",
        itemCount: 3,
        firstVehicleTitle: "Li L7",
      }),
      'Подборка "Для Ивана"',
    );
  });

  it("formats mileage with grouped thousands and км", () => {
    assert.equal(parseOfferMileageKm("49000"), 49000);
    assert.equal(parseOfferMileageKm("49 000"), 49000);
    assert.equal(formatOfferMileageKm(49000)?.replace(/\u00a0/g, " "), "49 000 км");
    assert.equal(formatOfferMileageInput(49000), "49 000");
    assert.equal(parseOfferMileageKm(""), null);
    assert.equal(formatOfferMileageKm(null), null);
  });

  it("falls back to the car count without a selection title", () => {
    assert.equal(
      buildSelectionLinkCaption({
        itemCount: 2,
        firstVehicleTitle: "Li L7",
      }),
      "Подборка (2 авто)",
    );
  });
});
