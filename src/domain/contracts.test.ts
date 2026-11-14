import { describe, expect, expectTypeOf, it } from "vitest";
import { demoFestival } from "../fixtures/demoFestival";
import { demoSimulationResult } from "../fixtures/demoSimulationResult";
import {
  multiDestinationAlternativeResult,
  multiDestinationFestival,
  multiDestinationSimulationResult,
} from "../fixtures/multiDestination";
import type { Festival } from "./model";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  minimumVendorPriceFactor,
  resolveBehaviorSettings,
} from "./behavior";
import type {
  CompareScenarios,
  RunSimulation,
  SimulationEvent,
  SimulationResult,
  SimulationSettings,
} from "./simulation";

const multiDestinationEvents: SimulationEvent[] =
  multiDestinationSimulationResult.events;

function eventsOfType<T extends SimulationEvent["type"]>(type: T) {
  return multiDestinationEvents.filter(
    (event): event is Extract<SimulationEvent, { type: T }> =>
      event.type === type,
  );
}

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
    expectUniqueIds([
      multiDestinationFestival.id,
      ...multiDestinationFestival.entrances.map(({ id }) => id),
      ...multiDestinationFestival.stages.map(({ id }) => id),
      ...multiDestinationFestival.vendors.map(({ id }) => id),
      ...multiDestinationFestival.amenities.map(({ id }) => id),
    ]);
    for (const frame of demoSimulationResult.frames) {
      expectUniqueIds(frame.attendees.map(({ id }) => id));
      expectUniqueIds(frame.vendors.map(({ vendorId }) => vendorId));
    }
  });

  it("serializes every shared fixture through JSON without data loss", () => {
    for (const fixture of [
      demoFestival,
      demoSimulationResult,
      multiDestinationFestival,
      multiDestinationSimulationResult,
      multiDestinationAlternativeResult,
    ]) {
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

  it("resolves bounded multi-destination defaults and rejects invalid limits", () => {
    expect(resolveBehaviorSettings(undefined)).toEqual(
      DEFAULT_BEHAVIOR_SETTINGS,
    );
    expect(
      resolveBehaviorSettings({
        maximumItineraryStops: 6,
        maximumVendorStops: 0,
        maximumStageStops: 6,
        maximumAmenityStops: 3,
      }),
    ).toMatchObject({
      maximumItineraryStops: 6,
      maximumVendorStops: 0,
      maximumStageStops: 6,
      maximumAmenityStops: 3,
    });
    expect(() =>
      resolveBehaviorSettings({ maximumItineraryStops: 0 }),
    ).toThrow(/maximumItineraryStops/);
    expect(() =>
      resolveBehaviorSettings({ maximumItineraryStops: 7 }),
    ).toThrow(/maximumItineraryStops/);
    expect(() =>
      resolveBehaviorSettings({
        maximumItineraryStops: 2,
        maximumVendorStops: 3,
      }),
    ).toThrow(/maximumVendorStops/);
  });

  it("stores finite, non-negative, bounded individual behavior profiles", () => {
    for (const profile of multiDestinationSimulationResult.attendeeProfiles) {
      const weights = [
        ...Object.values(profile.destinationTypeWeights),
        ...Object.values(profile.vendorCategoryWeights),
      ];
      expect(weights.every((weight) => Number.isFinite(weight))).toBe(true);
      expect(weights.every((weight) => weight >= 0 && weight <= 10)).toBe(true);
      expect(profile.initialBudget).toBeGreaterThanOrEqual(0);
      expect(profile.walkingSpeedMultiplier).toBeGreaterThan(0);
      expect(profile.visitDurationToleranceSeconds).toBeGreaterThan(0);
    }
  });

  it("demonstrates bounded distinct visits without immediate duplicates", () => {
    const settings = multiDestinationSimulationResult.settings.behavior;
    const starts = eventsOfType("destination_visit_start");
    const byAttendee = Map.groupBy(starts, (event) => event.attendeeId);

    for (const visits of byAttendee.values()) {
      const ordered = [...visits].sort((left, right) =>
        left.visitOrder - right.visitOrder,
      );
      expect(ordered.length).toBeLessThanOrEqual(
        settings.maximumItineraryStops,
      );
      expect(
        ordered.filter(({ destinationType }) => destinationType === "vendor"),
      ).toHaveLength(
        Math.min(
          ordered.filter(({ destinationType }) => destinationType === "vendor")
            .length,
          settings.maximumVendorStops,
        ),
      );
      expect(
        ordered.filter(({ destinationType }) => destinationType === "stage")
          .length,
      ).toBeLessThanOrEqual(settings.maximumStageStops);
      expect(
        ordered.filter(({ destinationType }) =>
          ["restroom", "seating", "first_aid"].includes(destinationType),
        ).length,
      ).toBeLessThanOrEqual(settings.maximumAmenityStops);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index]!.destinationId).not.toBe(
          ordered[index - 1]!.destinationId,
        );
      }
      expect(new Set(ordered.map(({ destinationId }) => destinationId)).size).toBe(
        ordered.length,
      );
    }
  });

  it("reconciles multiple purchases with budgets and inventory", () => {
    const attendeeId = "attendee-multi-vendor";
    const profile = multiDestinationSimulationResult.attendeeProfiles.find(
      ({ id }) => id === attendeeId,
    )!;
    const purchases = eventsOfType("purchase").filter(
      (event) => event.attendeeId === attendeeId,
    );

    expect(purchases.map(({ vendorId }) => vendorId)).toEqual([
      "vendor-food",
      "vendor-drink",
    ]);
    let remainingBudget = profile.initialBudget;
    for (const purchase of purchases) {
      remainingBudget -= purchase.amount;
      expect(purchase.remainingBudget).toBe(remainingBudget);
    }
    expect(remainingBudget).toBe(12);

    for (const vendor of multiDestinationFestival.vendors) {
      const vendorPurchases = eventsOfType("purchase").filter(
        (event) => event.vendorId === vendor.id,
      );
      if (vendor.inventory !== null && vendorPurchases.length > 0) {
        expect(vendorPurchases.at(-1)?.inventoryRemaining).toBe(
          vendor.inventory - vendorPurchases.length,
        );
      }
    }
  });

  it("captures price-sensitive rejection, multiple stages, amenity order, and early exit", () => {
    const priceSensitive = multiDestinationSimulationResult.attendeeProfiles.find(
      ({ id }) => id === "attendee-price-sensitive",
    )!;
    const affordable = multiDestinationFestival.vendors.find(
      ({ id }) => id === "vendor-food",
    )!;
    const expensive = multiDestinationFestival.vendors.find(
      ({ id }) => id === "vendor-expensive",
    )!;
    const priceFactor = (price: number) =>
      minimumVendorPriceFactor(
        multiDestinationSimulationResult.settings.behavior.priceElasticity,
        priceSensitive.priceSensitivity,
        price,
        priceSensitive.initialBudget,
      );

    expect(expensive.averagePrice).toBeGreaterThan(priceSensitive.initialBudget);
    expect(priceFactor(expensive.averagePrice)).toBeLessThan(
      priceFactor(affordable.averagePrice),
    );
    expect(
      multiDestinationEvents.some(
        (event) =>
          "destinationId" in event &&
          event.attendeeId === priceSensitive.id &&
          event.destinationId === expensive.id,
      ),
    ).toBe(false);

    const stageAmenityStage = eventsOfType("destination_visit_start")
      .filter(
        (event) =>
          event.attendeeId === "attendee-stage-amenity-stage",
      )
      .map(({ destinationType }) => destinationType);
    expect(stageAmenityStage).toEqual(["stage", "restroom", "stage"]);
    expect(
      multiDestinationEvents.find(
        (event) =>
          event.type === "exit" &&
          event.attendeeId === "attendee-early-exit",
      ),
    ).toMatchObject({ reason: "seeded_exit_decision", completedStops: 1 });
  });

  it("allows missing destination types and reuses exact profiles for comparison", () => {
    const entranceOnlyFestival: Festival = {
      schemaVersion: 1,
      id: "entrance-only",
      name: "No selectable destinations",
      boundsMeters: { width: 10, height: 10 },
      entrances: [
        {
          id: "entrance-only",
          name: "Only entrance",
          position: { x: 1, y: 1 },
          spawnWeight: 1,
        },
      ],
      stages: [],
      paths: [],
      obstacles: [],
      vendors: [],
    };
    expect(entranceOnlyFestival.amenities).toBeUndefined();
    expect(JSON.parse(JSON.stringify(entranceOnlyFestival))).toEqual(
      entranceOnlyFestival,
    );
    expect(multiDestinationAlternativeResult.attendeeProfiles).toEqual(
      multiDestinationSimulationResult.attendeeProfiles,
    );
    expect(multiDestinationAlternativeResult.settings).toEqual(
      multiDestinationSimulationResult.settings,
    );
  });
});
