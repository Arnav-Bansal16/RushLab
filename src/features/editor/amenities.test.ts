import { describe, expect, it } from "vitest";
import {
  addComponent,
  createBlankLayout,
  editComponent,
  fromFestival,
  layoutItems,
  removeComponent,
  resizeSite,
} from "./layout";
import { prepareSimulationInput, snapshotFestival } from "./simulationInput";
import { vendorDemoSettings } from "../playback/vendorDemo";
import { demoFestival } from "../../fixtures/demoFestival";

const details = {
  name: "Destination",
  width: 4,
  height: 3,
  color: "#79a5be",
  shape: "rectangle" as const,
  category: "food" as const,
  servers: 1,
  attraction: 0.6,
};
describe("canonical amenity lifecycle", () => {
  it.each(["restroom", "seating", "first_aid"] as const)(
    "creates/edits/moves/resizes/deletes %s without mutating history and snapshots",
    (type) => {
      expect(createBlankLayout().amenities).toEqual([]);
      const original = fromFestival(demoFestival);
      const added = addComponent(original, {
        ...details,
        kind: type,
        dwellDurationOverrideSeconds: { minimum: 5, maximum: 12 },
      });
      expect(added.document.editor.elements).toHaveLength(0);
      expect(original.amenities).toBeUndefined();
      const edited = editComponent(added.document, added.id, {
        name: "Updated",
        position: { x: 3, y: 4 },
        size: { width: 5, height: 6 },
      });
      expect(edited.amenities![0]).toMatchObject({
        type,
        attraction: 0.6,
        name: "Updated",
        position: { x: 3, y: 4 },
        size: { width: 5, height: 6 },
        dwellDurationOverrideSeconds: { minimum: 5, maximum: 12 },
      });
      const shrunk = resizeSite(edited, { width: 6, height: 6 });
      expect(shrunk.amenities![0].position).toEqual({ x: 1, y: 0 });
      const input = prepareSimulationInput(edited, vendorDemoSettings);
      if (!input.ok) throw new Error(input.errors.join(" "));
      expect(JSON.parse(JSON.stringify(input.festival))).toEqual(
        input.festival,
      );
      edited.amenities![0].dwellDurationOverrideSeconds!.minimum = 99;
      expect(
        input.festival.amenities![0].dwellDurationOverrideSeconds!.minimum,
      ).toBe(5);
      expect(
        layoutItems(removeComponent(edited, added.id)).some(
          (item) => item.id === added.id,
        ),
      ).toBe(false);
      expect(added.document.amenities![0].name).toBe("Destination"); // retained undo state
    },
  );
  it("preserves inherited absence, backwards-compatible import and rejects duplicate IDs/invalid attractions", () => {
    const source = fromFestival(demoFestival);
    const added = addComponent(source, {
      ...details,
      kind: "seating",
    }).document;
    expect(snapshotFestival(added).amenities![0]).not.toHaveProperty(
      "dwellDurationOverrideSeconds",
    );
    for (const attraction of [-1, Infinity, NaN]) {
      expect(() =>
        addComponent(source, { ...details, kind: "stage", attraction }),
      ).toThrow();
      const invalid = structuredClone(added);
      invalid.amenities![0].attraction = attraction;
      expect(prepareSimulationInput(invalid, vendorDemoSettings).ok).toBe(
        false,
      );
    }
    added.amenities![0].id = added.vendors[0].id;
    expect(prepareSimulationInput(added, vendorDemoSettings).ok).toBe(false);
  });
});
