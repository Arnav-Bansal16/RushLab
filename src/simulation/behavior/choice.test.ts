import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  type AttendeeProfile,
  type Festival,
  type Vendor,
} from "../../domain";
import { RandomStream } from "../random";
import {
  calculateVendorUtility,
  createAttendeeChoiceStream,
  generateRoamingWaypoints,
  resolveDestinations,
  sampleDwellDurationSeconds,
  selectDestination,
} from ".";

const vendor: Vendor = {
  id: "vendor-a",
  name: "Vendor A",
  category: "food",
  position: { x: 4, y: 4 },
  size: { width: 1, height: 1 },
  popularity: 0.8,
  averagePrice: 10,
  serviceTimeSeconds: 2,
  servers: 1,
  inventory: 10,
  queueLimit: 10,
};

const profile: AttendeeProfile = {
  id: "attendee-a",
  choiceStreamKey: "choice:attendee-a",
  entranceId: "entrance-a",
  spawnTimeSeconds: 0,
  intent: "vendor_first",
  destinationTypeWeights: {
    stage: 1,
    vendor: 1,
    restroom: 1,
    seating: 1,
    first_aid: 1,
  },
  vendorCategoryWeights: {
    food: 1.2,
    drink: 1,
    merchandise: 1,
    activity: 1,
    other: 1,
  },
  priceSensitivity: 0.5,
  queueToleranceSeconds: 60,
  walkingSpeedMultiplier: 1,
  stageAttractionPreference: 1,
  explorationTendency: 0.5,
  amenityTendency: 0.5,
  dwellDurationTendency: 1,
  exitTendency: 0.5,
  visitDurationToleranceSeconds: 1_000,
  initialBudget: 30,
};

const festival: Festival = {
  schemaVersion: 1,
  id: "behavior-unit",
  name: "Behavior unit fixture",
  boundsMeters: { width: 20, height: 10 },
  entrances: [
    {
      id: "entrance-a",
      name: "Entrance",
      position: { x: 0, y: 0 },
      spawnWeight: 1,
    },
  ],
  stages: [
    {
      id: "stage-default",
      name: "Default stage",
      position: { x: 5, y: 5 },
      size: { width: 1, height: 1 },
      attraction: 1,
    },
    {
      id: "stage-override",
      name: "Override stage",
      position: { x: 6, y: 5 },
      size: { width: 1, height: 1 },
      attraction: 1,
      dwellDurationOverrideSeconds: { minimum: 7, maximum: 9 },
    },
  ],
  vendors: [vendor],
  amenities: [
    {
      id: "restroom-a",
      name: "Restroom",
      type: "restroom",
      position: { x: 3, y: 3 },
      size: { width: 1, height: 1 },
      attraction: 1,
    },
  ],
  paths: [],
  obstacles: [],
};

describe("SIM-03 behavior choices", () => {
  it("uses the approved price factor exactly and rejects unaffordable vendors", () => {
    const expected =
      DEFAULT_BEHAVIOR_SETTINGS.destinationTypeWeights.vendor *
      profile.vendorCategoryWeights.food *
      vendor.popularity *
      Math.exp(
        -DEFAULT_BEHAVIOR_SETTINGS.priceElasticity *
          profile.priceSensitivity *
          vendor.averagePrice /
          30,
      );
    expect(
      calculateVendorUtility(
        vendor,
        profile,
        DEFAULT_BEHAVIOR_SETTINGS,
        30,
      ),
    ).toBeCloseTo(expected, 12);
    expect(
      calculateVendorUtility(
        { ...vendor, averagePrice: 31 },
        profile,
        DEFAULT_BEHAVIOR_SETTINGS,
        30,
      ),
    ).toBe(0);

    const lowElasticity = calculateVendorUtility(
      vendor,
      profile,
      { ...DEFAULT_BEHAVIOR_SETTINGS, priceElasticity: 0 },
      30,
    );
    const highElasticity = calculateVendorUtility(
      vendor,
      profile,
      { ...DEFAULT_BEHAVIOR_SETTINGS, priceElasticity: 10 },
      30,
    );
    expect(highElasticity).toBeLessThan(lowElasticity);
  });

  it("resolves global dwell ranges and location overrides once", () => {
    const destinations = resolveDestinations(festival, {
      ...DEFAULT_BEHAVIOR_SETTINGS,
      dwellDurationSeconds: {
        ...DEFAULT_BEHAVIOR_SETTINGS.dwellDurationSeconds,
        stage: { minimum: 2, maximum: 4 },
        restroom: { minimum: 3, maximum: 5 },
      },
    });
    expect(
      destinations.find(({ id }) => id === "stage-default")
        ?.dwellDurationSeconds,
    ).toEqual({ minimum: 2, maximum: 4 });
    expect(
      destinations.find(({ id }) => id === "stage-override")
        ?.dwellDurationSeconds,
    ).toEqual({ minimum: 7, maximum: 9 });
    expect(
      destinations.find(({ id }) => id === "restroom-a")
        ?.dwellDurationSeconds,
    ).toEqual({ minimum: 3, maximum: 5 });
  });

  it("keeps dwell samples within the resolved range and fixed steps", () => {
    const choice = new RandomStream(44);
    for (let index = 0; index < 20; index += 1) {
      const duration = sampleDwellDurationSeconds(
        { minimum: 3, maximum: 7 },
        1,
        0.5,
        choice,
      );
      expect(duration).toBeGreaterThanOrEqual(3);
      expect(duration).toBeLessThanOrEqual(7);
      expect(duration / 0.5).toBe(Math.round(duration / 0.5));
    }
  });

  it.each([0, 1, 2])(
    "generates %i deterministic in-bounds roaming waypoints",
    (count) => {
      const first = generateRoamingWaypoints(
        festival,
        count,
        createAttendeeChoiceStream(17, profile.choiceStreamKey),
      );
      const repeated = generateRoamingWaypoints(
        festival,
        count,
        createAttendeeChoiceStream(17, profile.choiceStreamKey),
      );
      expect(first).toEqual(repeated);
      expect(first).toHaveLength(count);
      expect(
        first.every(
          ({ x, y }) =>
            x >= 0 &&
            x <= festival.boundsMeters.width &&
            y >= 0 &&
            y <= festival.boundsMeters.height,
        ),
      ).toBe(true);
    },
  );

  it("enforces overall, per-type, revisit, immediate-duplicate, time, and budget bounds", () => {
    const destinations = resolveDestinations(festival, DEFAULT_BEHAVIOR_SETTINGS);
    const baseState = {
      completedStops: 0,
      vendorStops: 0,
      stageStops: 0,
      amenityStops: 0,
      lastDestinationId: null,
      visitsByDestination: new Map<string, number>(),
      remainingBudget: 30,
      position: { x: 0, y: 0 },
      timeSeconds: 0,
      visitDeadlineSeconds: 100,
    };
    const inventory = new Map([[vendor.id, 10]]);
    const choice = { weightedIndex: () => 0 };

    expect(
      selectDestination(
        destinations,
        profile,
        { ...DEFAULT_BEHAVIOR_SETTINGS, maximumItineraryStops: 1 },
        { ...baseState, completedStops: 1 },
        1,
        inventory,
        choice,
      ).reason,
    ).toBe("itinerary_limit");
    expect(
      selectDestination(
        destinations.filter(({ type }) => type === "vendor"),
        profile,
        DEFAULT_BEHAVIOR_SETTINGS,
        { ...baseState, remainingBudget: 1 },
        1,
        inventory,
        choice,
      ).reason,
    ).toBe("insufficient_budget");
    expect(
      selectDestination(
        destinations,
        profile,
        { ...DEFAULT_BEHAVIOR_SETTINGS, minimumRemainingTimeSeconds: 30 },
        { ...baseState, visitDeadlineSeconds: 29 },
        1,
        inventory,
        choice,
      ).reason,
    ).toBe("insufficient_time");
    expect(
      selectDestination(
        destinations.filter(({ id }) => id === vendor.id),
        profile,
        DEFAULT_BEHAVIOR_SETTINGS,
        {
          ...baseState,
          lastDestinationId: vendor.id,
          visitsByDestination: new Map([[vendor.id, 1]]),
        },
        1,
        inventory,
        choice,
      ).reason,
    ).toBe("no_eligible_destination");
  });

  it("safe-exits when every eligible destination weight is zero", () => {
    const zeroWeights = Object.fromEntries(
      Object.keys(DEFAULT_BEHAVIOR_SETTINGS.destinationTypeWeights).map(
        (type) => [type, 0],
      ),
    ) as typeof DEFAULT_BEHAVIOR_SETTINGS.destinationTypeWeights;
    const result = selectDestination(
      resolveDestinations(festival, DEFAULT_BEHAVIOR_SETTINGS),
      profile,
      {
        ...DEFAULT_BEHAVIOR_SETTINGS,
        destinationTypeWeights: zeroWeights,
      },
      {
        completedStops: 0,
        vendorStops: 0,
        stageStops: 0,
        amenityStops: 0,
        lastDestinationId: null,
        visitsByDestination: new Map(),
        remainingBudget: 30,
        position: { x: 0, y: 0 },
        timeSeconds: 0,
        visitDeadlineSeconds: 100,
      },
      1,
      new Map([[vendor.id, 10]]),
      { weightedIndex: () => 0 },
    );
    expect(result).toEqual({ reason: "no_eligible_destination" });
  });

  it("can change modeled vendor demand when price or elasticity changes", () => {
    const highestUtility = {
      weightedIndex: (weights: readonly number[]) =>
        weights[0]! >= weights[1]! ? 0 : 1,
    };
    const state = {
      completedStops: 0,
      vendorStops: 0,
      stageStops: 0,
      amenityStops: 0,
      lastDestinationId: null,
      visitsByDestination: new Map<string, number>(),
      remainingBudget: 30,
      position: { x: 0, y: 0 },
      timeSeconds: 0,
      visitDeadlineSeconds: 100,
    };
    const lowPriceFestival = {
      ...festival,
      stages: [],
      amenities: [],
      vendors: [
        { ...vendor, id: "vendor-a", averagePrice: 5 },
        { ...vendor, id: "vendor-b", averagePrice: 10 },
      ],
    };
    const highPriceFestival = {
      ...lowPriceFestival,
      vendors: lowPriceFestival.vendors.map((item) =>
        item.id === "vendor-a" ? { ...item, averagePrice: 20 } : item,
      ),
    };
    const inventory = new Map<string, number | null>([
      ["vendor-a", 10],
      ["vendor-b", 10],
    ]);
    const elasticSettings = {
      ...DEFAULT_BEHAVIOR_SETTINGS,
      priceElasticity: 10,
    };
    expect(
      selectDestination(
        resolveDestinations(lowPriceFestival, elasticSettings),
        profile,
        elasticSettings,
        state,
        10,
        inventory,
        highestUtility,
      ).destination?.id,
    ).toBe("vendor-a");
    expect(
      selectDestination(
        resolveDestinations(highPriceFestival, elasticSettings),
        profile,
        elasticSettings,
        state,
        10,
        inventory,
        highestUtility,
      ).destination?.id,
    ).toBe("vendor-b");
  });
});
