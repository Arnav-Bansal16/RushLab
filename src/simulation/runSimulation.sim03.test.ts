import { describe, expect, it } from "vitest";
import type {
  Festival,
  SimulationEvent,
  SimulationResult,
  SimulationSettings,
  Vendor,
} from "../domain";
import { DEFAULT_BEHAVIOR_SETTINGS } from "../domain";
import { deriveSimulationMetrics } from "../analytics/metrics";
import { runSimulation } from ".";

const baseVendor: Vendor = {
  id: "vendor-a",
  name: "Vendor A",
  category: "food",
  position: { x: 2, y: 1 },
  size: { width: 1, height: 1 },
  popularity: 1,
  averagePrice: 5,
  serviceTimeSeconds: 1,
  servers: 20,
  inventory: null,
  queueLimit: null,
};

function festival(overrides: Partial<Festival> = {}): Festival {
  return {
    schemaVersion: 1,
    id: "festival-sim-03",
    name: "SIM-03 Festival",
    boundsMeters: { width: 30, height: 20 },
    entrances: [
      {
        id: "entrance-a",
        name: "Entrance",
        position: { x: 1, y: 1 },
        spawnWeight: 1,
      },
    ],
    stages: [],
    paths: [],
    obstacles: [],
    vendors: [baseVendor],
    amenities: [],
    ...overrides,
  };
}

function settings(
  overrides: Partial<SimulationSettings> = {},
): SimulationSettings {
  return {
    seed: 17,
    attendeeCount: 20,
    durationSeconds: 120,
    stepSeconds: 1,
    frameIntervalSeconds: 1,
    walkingSpeedMetersPerSecond: 10,
    behavior: {
      minimumRemainingTimeSeconds: 0,
      deterministicExitProbabilityAfterStop: 0,
      dwellDurationSeconds: {
        stage: { minimum: 1, maximum: 1 },
        restroom: { minimum: 1, maximum: 1 },
        seating: { minimum: 1, maximum: 1 },
        first_aid: { minimum: 1, maximum: 1 },
      },
    },
    ...overrides,
  };
}

function eventsOfType<T extends SimulationEvent["type"]>(
  result: SimulationResult,
  type: T,
): Extract<SimulationEvent, { type: T }>[] {
  return result.events.filter(
    (event): event is Extract<SimulationEvent, { type: T }> =>
      event.type === type,
  );
}

describe("runSimulation SIM-03 behavior", () => {
  it("assigns a stable intent mix and snapshots resolved defaults", () => {
    const source = festival();
    const runSettings = settings({ attendeeCount: 400 });
    const first = runSimulation(source, runSettings).attendeeProfiles;
    const repeated = runSimulation(source, runSettings).attendeeProfiles;
    expect(repeated).toEqual(first);
    expect(new Set(first.map(({ intent }) => intent))).toEqual(
      new Set(["stage_first", "vendor_first", "explorer", "amenity_first"]),
    );

    const result = runSimulation(source, settings({ attendeeCount: 0 }));
    expect(result.settings.behavior.maximumItineraryStops).toBe(
      DEFAULT_BEHAVIOR_SETTINGS.maximumItineraryStops,
    );
    expect(result.settings.behavior.intentWeights).toEqual(
      DEFAULT_BEHAVIOR_SETTINGS.intentWeights,
    );
  });

  it("allows distinct affordable vendor purchases and deducts each price once", () => {
    const source = festival({
      vendors: [
        baseVendor,
        {
          ...baseVendor,
          id: "vendor-b",
          name: "Vendor B",
          category: "drink",
          position: { x: 3, y: 1 },
        },
        {
          ...baseVendor,
          id: "vendor-unaffordable",
          name: "Unaffordable vendor",
          position: { x: 4, y: 1 },
          averagePrice: 1_000,
        },
      ],
    });
    const result = runSimulation(
      source,
      settings({
        attendeeCount: 30,
        behavior: {
          maximumItineraryStops: 2,
          maximumVendorStops: 2,
          maximumStageStops: 0,
          maximumAmenityStops: 0,
          maximumVisitsPerDestination: 1,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
        },
      }),
    );
    const purchases = eventsOfType(result, "purchase");
    expect(purchases.some(({ vendorId }) => vendorId === "vendor-unaffordable")).toBe(
      false,
    );
    const byAttendee = new Map<string, typeof purchases>();
    for (const purchase of purchases) {
      const attendeePurchases = byAttendee.get(purchase.attendeeId) ?? [];
      attendeePurchases.push(purchase);
      byAttendee.set(purchase.attendeeId, attendeePurchases);
    }
    const multiple = [...byAttendee.entries()].find(
      ([, attendeePurchases]) => attendeePurchases.length === 2,
    );
    expect(multiple).toBeDefined();
    if (!multiple) return;
    const [attendeeId, attendeePurchases] = multiple;
    expect(new Set(attendeePurchases.map(({ vendorId }) => vendorId)).size).toBe(2);
    const profile = result.attendeeProfiles.find(({ id }) => id === attendeeId)!;
    expect(attendeePurchases[0]?.remainingBudget).toBe(profile.initialBudget - 5);
    expect(attendeePurchases[1]?.remainingBudget).toBe(profile.initialBudget - 10);
    const finalFrame = result.frames.at(-1)?.attendees.find(
      ({ id }) => id === attendeeId,
    );
    expect(finalFrame?.remainingBudget).toBe(profile.initialBudget - 10);
  });

  it("visits stages and amenities while enforcing overall and per-type caps", () => {
    const source = festival({
      vendors: [],
      stages: [
        {
          id: "stage-a",
          name: "Stage A",
          position: { x: 2, y: 2 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
        {
          id: "stage-b",
          name: "Stage B",
          position: { x: 3, y: 2 },
          size: { width: 1, height: 1 },
          attraction: 0.8,
        },
      ],
      amenities: [
        {
          id: "restroom-a",
          name: "Restroom",
          type: "restroom",
          position: { x: 2, y: 3 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
        {
          id: "seating-a",
          name: "Seating",
          type: "seating",
          position: { x: 3, y: 3 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
      ],
    });
    const result = runSimulation(source, settings({ attendeeCount: 30 }));
    const starts = eventsOfType(result, "destination_visit_start");
    expect(starts.some(({ destinationType }) => destinationType === "stage")).toBe(
      true,
    );
    expect(
      starts.some(
        ({ destinationType }) =>
          destinationType === "restroom" || destinationType === "seating",
      ),
    ).toBe(true);

    for (const profile of result.attendeeProfiles) {
      const visits = starts.filter(({ attendeeId }) => attendeeId === profile.id);
      expect(visits.length).toBeLessThanOrEqual(4);
      expect(visits.filter(({ destinationType }) => destinationType === "stage").length).toBeLessThanOrEqual(2);
      expect(visits.filter(({ destinationType }) => destinationType !== "stage").length).toBeLessThanOrEqual(2);
      expect(
        visits.every(
          (visit, index) =>
            index === 0 || visit.destinationId !== visits[index - 1]!.destinationId,
        ),
      ).toBe(true);
      expect(new Set(visits.map(({ destinationId }) => destinationId)).size).toBe(
        visits.length,
      );
    }
  });

  it("permits explicit revisits but keeps them bounded and non-consecutive", () => {
    const source = festival({
      vendors: [],
      stages: [
        {
          id: "stage-a",
          name: "Stage A",
          position: { x: 2, y: 1 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
        {
          id: "stage-b",
          name: "Stage B",
          position: { x: 3, y: 1 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
      ],
    });
    const result = runSimulation(
      source,
      settings({
        attendeeCount: 10,
        behavior: {
          maximumItineraryStops: 4,
          maximumVendorStops: 0,
          maximumStageStops: 4,
          maximumAmenityStops: 0,
          maximumVisitsPerDestination: 2,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          destinationTypeWeights: { vendor: 0 },
          dwellDurationSeconds: { stage: { minimum: 1, maximum: 1 } },
        },
      }),
    );
    const starts = eventsOfType(result, "destination_visit_start");
    const fourVisitAttendee = result.attendeeProfiles.find(
      ({ id }) => starts.filter(({ attendeeId }) => attendeeId === id).length === 4,
    );
    expect(fourVisitAttendee).toBeDefined();
    if (!fourVisitAttendee) return;
    const visits = starts.filter(
      ({ attendeeId }) => attendeeId === fourVisitAttendee.id,
    );
    expect(visits.map(({ visitOrder }) => visitOrder)).toEqual([1, 2, 3, 4]);
    expect(visits.map(({ isRepeatVisit }) => isRepeatVisit)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(
      visits.every(
        (visit, index) =>
          index === 0 || visit.destinationId !== visits[index - 1]!.destinationId,
      ),
    ).toBe(true);
  });

  it("records completed and run-truncated dwell intervals", () => {
    const source = festival({
      vendors: [],
      stages: [
        {
          id: "stage-a",
          name: "Stage A",
          position: { x: 1, y: 1 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
      ],
    });
    const completed = runSimulation(
      source,
      settings({
        attendeeCount: 10,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 0,
          maximumStageStops: 1,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          dwellDurationSeconds: { stage: { minimum: 1, maximum: 1 } },
        },
      }),
    );
    expect(
      eventsOfType(completed, "destination_visit_end").some(
        ({ truncated, durationSeconds }) => !truncated && durationSeconds === 1,
      ),
    ).toBe(true);

    const truncated = runSimulation(
      source,
      settings({
        attendeeCount: 60,
        durationSeconds: 20,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 0,
          maximumStageStops: 1,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          dwellDurationSeconds: { stage: { minimum: 0, maximum: 100 } },
        },
      }),
    );
    expect(
      eventsOfType(truncated, "destination_visit_end").some(
        ({ truncated: wasTruncated }) => wasTruncated,
      ),
    ).toBe(true);

    const subStep = runSimulation(
      source,
      settings({
        attendeeCount: 30,
        durationSeconds: 20,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 0,
          maximumStageStops: 1,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          dwellDurationSeconds: { stage: { minimum: 0.1, maximum: 0.2 } },
        },
      }),
    );
    const completedSubStepDwells = eventsOfType(
      subStep,
      "destination_visit_end",
    ).filter(({ truncated: wasTruncated }) => !wasTruncated);
    expect(completedSubStepDwells.length).toBeGreaterThan(0);
    expect(
      completedSubStepDwells.every(
        ({ durationSeconds }) =>
          durationSeconds >= 0.1 - Number.EPSILON &&
          durationSeconds <= 0.2 + Number.EPSILON,
      ),
    ).toBe(true);
  });

  it("applies queue tolerance multiplier boundaries zero and five", () => {
    const source = festival({
      vendors: [{ ...baseVendor, position: { x: 1, y: 1 }, servers: 0 }],
    });
    const zero = runSimulation(
      source,
      settings({
        seed: 2,
        attendeeCount: 10,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 1,
          maximumStageStops: 0,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          queueToleranceMultiplier: 0,
        },
      }),
    );
    expect(eventsOfType(zero, "queue_join")).toHaveLength(0);
    expect(eventsOfType(zero, "queue_abandon")).toHaveLength(0);
    expect(
      eventsOfType(zero, "exit").some(
        ({ reason }) => reason === "queue_tolerance_exceeded",
      ),
    ).toBe(true);

    const five = runSimulation(
      source,
      settings({
        seed: 2,
        attendeeCount: 10,
        durationSeconds: 40,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 1,
          maximumStageStops: 0,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          queueToleranceMultiplier: 5,
        },
      }),
    );
    expect(eventsOfType(five, "queue_join").length).toBeGreaterThan(0);
    expect(eventsOfType(five, "queue_abandon")).toHaveLength(0);
  });

  it("reserves immediate service capacity across simultaneous zero-tolerance arrivals", () => {
    const source = festival({
      vendors: [
        {
          ...baseVendor,
          position: { x: 1, y: 1 },
          servers: 1,
          serviceTimeSeconds: 100,
        },
      ],
    });
    const result = runSimulation(
      source,
      settings({
        attendeeCount: 300,
        durationSeconds: 200,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 1,
          maximumStageStops: 0,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          queueToleranceMultiplier: 0,
        },
      }),
    );
    const joins = eventsOfType(result, "queue_join");
    const starts = eventsOfType(result, "service_start");
    expect(joins.length).toBeGreaterThan(0);
    expect(joins).toHaveLength(starts.length);
    expect(eventsOfType(result, "queue_abandon")).toHaveLength(0);
    expect(
      deriveSimulationMetrics(result.events, source.vendors, result.settings),
    ).toEqual({ vendorMetrics: result.vendorMetrics, totals: result.totals });
  });

  it("keeps run-ended attendees at their final world position", () => {
    const source = festival({
      vendors: [],
      stages: [
        {
          id: "stage-far",
          name: "Far stage",
          position: { x: 10, y: 1 },
          size: { width: 1, height: 1 },
          attraction: 1,
        },
      ],
    });
    const result = runSimulation(
      source,
      settings({
        attendeeCount: 40,
        durationSeconds: 30,
        walkingSpeedMetersPerSecond: 1,
        behavior: {
          maximumItineraryStops: 1,
          maximumVendorStops: 0,
          maximumStageStops: 1,
          maximumAmenityStops: 0,
          minimumRemainingTimeSeconds: 0,
          deterministicExitProbabilityAfterStop: 0,
          destinationTypeWeights: {
            stage: 1,
            vendor: 0,
            restroom: 0,
            seating: 0,
            first_aid: 0,
          },
          dwellDurationSeconds: { stage: { minimum: 0, maximum: 100 } },
        },
      }),
    );
    const finalAttendees = result.frames.at(-1)!.attendees;
    expect(finalAttendees.every(({ status }) => status === "exited")).toBe(true);
    expect(
      finalAttendees.some(
        ({ position }) => position.x !== 1 || position.y !== 1,
      ),
    ).toBe(true);
    expect(
      eventsOfType(result, "exit").some(({ reason }) => reason === "run_ended"),
    ).toBe(true);
  });

  it("reconciles frames, destination events, exits, and ANA-01 metrics", () => {
    const source = festival({
      vendors: [baseVendor, { ...baseVendor, id: "vendor-b", position: { x: 3, y: 1 } }],
    });
    const sourceBefore = structuredClone(source);
    const runSettings = settings({ attendeeCount: 25 });
    const settingsBefore = structuredClone(runSettings);
    const result = runSimulation(source, runSettings);
    const starts = eventsOfType(result, "destination_visit_start");
    const ends = eventsOfType(result, "destination_visit_end");
    const exits = eventsOfType(result, "exit");

    expect(ends).toHaveLength(starts.length);
    expect(exits).toHaveLength(result.attendeeProfiles.length);
    for (const end of ends) {
      expect(
        starts.some(
          (start) =>
            start.attendeeId === end.attendeeId &&
            start.destinationId === end.destinationId &&
            start.visitOrder === end.visitOrder &&
            start.timeSeconds <= end.timeSeconds,
        ),
      ).toBe(true);
    }
    for (const frame of result.frames) {
      for (const attendee of frame.attendees) {
        expect(attendee.remainingBudget).toBeGreaterThanOrEqual(0);
        expect(attendee.completedStops).toBeLessThanOrEqual(4);
        if (attendee.target?.destinationType === "vendor") {
          expect(attendee.targetVendorId).toBe(attendee.target.destinationId);
        }
      }
    }
    expect(
      deriveSimulationMetrics(result.events, source.vendors, result.settings),
    ).toEqual({ vendorMetrics: result.vendorMetrics, totals: result.totals });
    expect(source).toEqual(sourceBefore);
    expect(runSettings).toEqual(settingsBefore);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("is same-seed equal, different-seed unequal, and snapshots compatible profiles", () => {
    const source = festival({
      vendors: [baseVendor, { ...baseVendor, id: "vendor-b", position: { x: 3, y: 1 } }],
    });
    const runSettings = settings({ attendeeCount: 25 });
    const first = runSimulation(source, runSettings);
    const repeated = runSimulation(source, runSettings);
    const different = runSimulation(source, { ...runSettings, seed: 99 });
    expect(repeated).toEqual(first);
    expect(different.attendeeProfiles).not.toEqual(first.attendeeProfiles);
    expect(different.events).not.toEqual(first.events);
    expect(first.attendeeProfiles.map(({ intent }) => intent)).toEqual(
      repeated.attendeeProfiles.map(({ intent }) => intent),
    );
    expect(first.settings.behavior).toEqual(repeated.settings.behavior);
  });
});
