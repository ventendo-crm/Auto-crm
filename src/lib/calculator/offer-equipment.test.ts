import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OFFER_EQUIPMENT_GROUPS,
  cloneOfferEquipmentGroups,
  formatOfferEquipmentLines,
  parseOfferEquipmentKeys,
  snapshotOfferEquipment,
} from "@/lib/calculator/offer-equipment";
import { resolveCompanyWorkspace } from "@/lib/company-workspace/resolve";

describe("offer equipment catalog", () => {
  it("uses stable keys that match the workspace validator", () => {
    const keys = new Set<string>();
    const groupIds = new Set<string>();
    for (const group of OFFER_EQUIPMENT_GROUPS) {
      assert.match(group.id, /^[a-z][a-z0-9_]{1,31}$/);
      assert.equal(groupIds.has(group.id), false);
      groupIds.add(group.id);
      for (const option of group.options) {
        assert.match(option.key, /^[a-z][a-z0-9_]{1,62}$/);
        assert.equal(option.key.startsWith("custom_"), false);
        assert.equal(keys.has(option.key), false);
        keys.add(option.key);
        assert.ok(option.label.trim().length > 0);
      }
    }
    assert.ok(keys.size >= 20);
  });

  it("parses keys from JSON, objects and a comma list", () => {
    assert.deepEqual(parseOfferEquipmentKeys('["awd","lidar"]'), ["awd", "lidar"]);
    assert.deepEqual(parseOfferEquipmentKeys([{ key: "hud" }, { key: "hud" }]), ["hud"]);
    assert.deepEqual(parseOfferEquipmentKeys("awd, lidar"), ["awd", "lidar"]);
    assert.deepEqual(parseOfferEquipmentKeys(["360_camera", "custom_x"]), []);
  });

  it("snapshots labels from the company catalog in group order", () => {
    const groups = cloneOfferEquipmentGroups();
    assert.deepEqual(snapshotOfferEquipment(["lidar", "awd", "missing"], groups), [
      { key: "awd", label: "Полный привод (4WD / AWD)" },
      { key: "lidar", label: "LiDAR" },
    ]);
  });

  it("uses the default catalog when the company column is empty", () => {
    const resolved = resolveCompanyWorkspace({ offerEquipmentGroups: [] });
    assert.deepEqual(resolved.offerEquipmentGroups, cloneOfferEquipmentGroups());
  });

  it("formats a bullet list for the phone share text", () => {
    assert.equal(
      formatOfferEquipmentLines([
        { label: "LiDAR" },
        { label: " Панорама " },
        { label: "" },
      ]),
      "• LiDAR\n• Панорама",
    );
    assert.equal(formatOfferEquipmentLines([]), "");
  });
});
