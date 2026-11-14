import { describe, expect, it } from "vitest";
import { demoFestival } from "../../fixtures/demoFestival";
import {
  addVendor,
  moveEntity,
  clampVendorPosition,
  fitViewport,
  metersToPixels,
  pixelsToMeters,
  updateVendor,
} from "./geometry";

describe("editor geometry", () => {
  it("round-trips world coordinates across viewport sizes without changing the layout", () => {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 320, height: 340 },
    ]) {
      const transform = fitViewport(demoFestival.boundsMeters, viewport);
      const world = demoFestival.vendors[0].position;
      const recovered = pixelsToMeters(
        metersToPixels(world, transform),
        transform,
      );
      expect(recovered.x).toBeCloseTo(world.x);
      expect(recovered.y).toBeCloseTo(world.y);
      const corner = metersToPixels({ x: 120, y: 80 }, transform);
      expect(corner.x).toBeLessThanOrEqual(viewport.width);
      expect(corner.y).toBeLessThanOrEqual(viewport.height);
    }
  });
  it("keeps the complete vendor footprint inside each edge", () => {
    const size = { width: 6, height: 4 };
    expect(
      clampVendorPosition({ x: -10, y: -20 }, size, demoFestival.boundsMeters),
    ).toEqual({ x: 0, y: 0 });
    expect(
      clampVendorPosition({ x: 150, y: 90 }, size, demoFestival.boundsMeters),
    ).toEqual({ x: 114, y: 76 });
    expect(
      clampVendorPosition({ x: 30, y: 40 }, size, demoFestival.boundsMeters),
    ).toEqual({ x: 30, y: 40 });
  });
  it("exports an edited festival while leaving the shared fixture untouched", () => {
    const before = structuredClone(demoFestival);
    const edited = updateVendor(demoFestival, "vendor-tacos", {
      position: { x: 200, y: -5 },
      name: "New name",
      servers: 3,
    });
    expect(demoFestival).toEqual(before);
    expect(edited.vendors[0]).toMatchObject({
      position: { x: 114, y: 0 },
      name: "New name",
      servers: 3,
    });
    expect(JSON.parse(JSON.stringify(edited))).toEqual(edited);
  });
});

describe("gate, stage, and vendor layout editing", () => {
  it("moves and clamps stages and gates without changing source data or paths", () => {
    const before = structuredClone(demoFestival);
    const movedStage = moveEntity(demoFestival, "stage-main", {
      x: 200,
      y: -4,
    });
    expect(movedStage.stages[0].position).toEqual({ x: 102, y: 0 });
    const movedGate = moveEntity(movedStage, "entrance-main", {
      x: -20,
      y: 100,
    });
    expect(movedGate.entrances[0].position).toEqual({ x: 0, y: 80 });
    expect(movedGate.stages[0].position).toEqual({ x: 102, y: 0 });
    expect(movedGate.paths).toEqual(before.paths);
    expect(demoFestival).toEqual(before);
    expect(JSON.parse(JSON.stringify(movedGate))).toEqual(movedGate);
  });

  it("adds multiple complete vendors with distinct IDs and independent positions", () => {
    const before = structuredClone(demoFestival);
    const first = addVendor(demoFestival, {
      name: " Coffee Corner ",
      category: "drink",
      servers: 2,
    });
    const second = addVendor(first.festival, {
      name: "Merch Tent",
      category: "merchandise",
      servers: 1,
    });
    expect(second.festival.vendors).toHaveLength(3);
    expect(first.vendor).toMatchObject({
      name: "Coffee Corner",
      category: "drink",
      servers: 2,
    });
    expect(new Set(second.festival.vendors.map((item) => item.id)).size).toBe(
      3,
    );
    const moved = moveEntity(second.festival, first.vendor.id, {
      x: 24,
      y: 12,
    });
    expect(
      moved.vendors.find((item) => item.id === first.vendor.id)?.position,
    ).toEqual({ x: 24, y: 12 });
    expect(moved.vendors.find((item) => item.id === second.vendor.id)).toEqual(
      second.vendor,
    );
    expect(demoFestival).toEqual(before);
    expect(JSON.parse(JSON.stringify(moved))).toEqual(moved);
  });

  it("avoids IDs already used by another map entity", () => {
    const festival = {
      ...demoFestival,
      entrances: [{ ...demoFestival.entrances[0], id: "vendor-2" }],
    };
    const added = addVendor(festival, {
      name: "Snack Bar",
      category: "food",
      servers: 1,
    });
    expect(added.vendor.id).toBe("vendor-3");
  });
});
