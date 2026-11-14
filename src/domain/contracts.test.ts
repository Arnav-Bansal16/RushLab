import { describe, expect, expectTypeOf, it } from "vitest";
import { demoFestival } from "../fixtures/demoFestival";
import { demoSimulationResult } from "../fixtures/demoSimulationResult";
import type { Festival } from "./model";
import type {
  CompareScenarios,
  RunSimulation,
  SimulationResult,
  SimulationSettings,
} from "./simulation";

function expectUniqueIds(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}

function expectPointInFestivalBounds(point: { x: number; y: number }) {
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
  expect(point.x).toBeGreaterThanOrEqual(0);
  expect(point.x).toBeLessThanOrEqual(demoFestival.boundsMeters.width);
  expect(point.y).toBeGreaterThanOrEqual(0);
  expect(point.y).toBeLessThanOrEqual(demoFestival.boundsMeters.height);
}

describe("shared contracts", () => {
  it("keeps the demo fixture in world-meter coordinates", () => {
    const festival: Festival = demoFestival;

    expect(demoFestival.boundsMeters).toEqual({ width: 120, height: 80 });
    expect(demoFestival.vendors.map((vendor) => vendor.id)).toEqual([
      "vendor-tacos",
    ]);

    expect(demoFestival.boundsMeters.width).toBeGreaterThan(0);
    expect(demoFestival.boundsMeters.height).toBeGreaterThan(0);
    for (const entrance of demoFestival.entrances) {
      expectPointInFestivalBounds(entrance.position);
    }
    for (const stage of demoFestival.stages) {
      expectPointInFestivalBounds(stage.position);
      expect(stage.size.width).toBeGreaterThan(0);
      expect(stage.size.height).toBeGreaterThan(0);
    }
    for (const path of demoFestival.paths) {
      expect(path.widthMeters).toBeGreaterThan(0);
      path.points.forEach(expectPointInFestivalBounds);
    }
    for (const obstacle of festival.obstacles) {
      obstacle.points.forEach(expectPointInFestivalBounds);
    }
    for (const vendor of demoFestival.vendors) {
      expectPointInFestivalBounds(vendor.position);
      expect(vendor.size.width).toBeGreaterThan(0);
      expect(vendor.size.height).toBeGreaterThan(0);
    }
    for (const frame of demoSimulationResult.frames) {
      frame.attendees.forEach(({ position }) =>
        expectPointInFestivalBounds(position),
      );
    }
  });

  it("uses unique IDs in every fixture identity scope", () => {
    const festival: Festival = demoFestival;

    expectUniqueIds([
      demoFestival.id,
      ...demoFestival.entrances.map(({ id }) => id),
      ...demoFestival.stages.map(({ id }) => id),
      ...demoFestival.paths.map(({ id }) => id),
      ...festival.obstacles.map(({ id }) => id),
      ...demoFestival.vendors.map(({ id }) => id),
    ]);
    expectUniqueIds(demoSimulationResult.attendeeProfiles.map(({ id }) => id));
    expectUniqueIds(
      demoSimulationResult.vendorMetrics.map(({ vendorId }) => vendorId),
    );
    for (const frame of demoSimulationResult.frames) {
      expectUniqueIds(frame.attendees.map(({ id }) => id));
      expectUniqueIds(frame.vendors.map(({ vendorId }) => vendorId));
    }
  });

  it("serializes every shared fixture through JSON without data loss", () => {
    for (const fixture of [demoFestival, demoSimulationResult]) {
      expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
    }
  });

  it("defines stable engine and comparison boundaries", () => {
    expectTypeOf<RunSimulation>().parameters.toEqualTypeOf<
      [festival: Festival, settings: SimulationSettings]
    >();
    expectTypeOf<CompareScenarios>().returns.toMatchTypeOf<
      ReturnType<CompareScenarios>
    >();
    expectTypeOf<SimulationResult["schemaVersion"]>().toEqualTypeOf<1>();
  });
});
