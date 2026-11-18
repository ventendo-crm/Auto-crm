import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOfferLinkCaption,
  buildSelectionLinkCaption,
  DEFAULT_OFFER_LINK_CAPTION_TEMPLATE,
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
