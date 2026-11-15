import { describe, expect, it } from "vitest";
import type {
  AttendeeProfile,
  BehaviorSettings,
  Festival,
  NumericMetricComparison,
  SimulationResult,
} from "../../domain";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import {
  multiDestinationFestival,
  multiDestinationSimulationResult,
} from "../../fixtures/multiDestination";
import { runSimulation } from "../../simulation";
import { assessScenarioCompatibility, compareScenarios } from ".";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function pair(source: SimulationResult = demoSimulationResult): {
  baseline: SimulationResult;
  alternative: SimulationResult;
} {
  return { baseline: clone(source), alternative: clone(source) };
}

function metric<K extends string>(
  metrics: NumericMetricComparison<K>[],
  key: K,
): NumericMetricComparison<K> {
  return metrics.find(({ metric: candidate }) => candidate === key)!;
}

describe("compareScenarios", () => {
  it("returns zero deltas for identical compatible nonzero outcomes", () => {
    const { baseline, alternative } = pair();
    const comparison = compareScenarios(baseline, alternative);

    expect(comparison.compatibility.status).toBe("compatible");
    expect(metric(comparison.totals!, "purchases")).toMatchObject({
      baseline: { status: "available", value: 1 },
      alternative: { status: "available", value: 1 },
      absoluteDelta: { status: "available", value: 0 },
      percentageDelta: { status: "available", value: 0 },
    });
  });

  it("uses alternative minus baseline for positive and negative changes", () => {
    const { baseline, alternative } = pair();
    alternative.totals.revenue = 18;
    alternative.totals.purchases = 0;
    const totals = compareScenarios(baseline, alternative).totals!;

    expect(metric(totals, "revenue").absoluteDelta).toEqual({
      status: "available",
      value: 6,
    });
    expect(metric(totals, "revenue").percentageDelta).toEqual({
      status: "available",
      value: 50,
    });
    expect(metric(totals, "purchases").absoluteDelta).toEqual({
      status: "available",
      value: -1,
    });
    expect(metric(totals, "purchases").percentageDelta).toEqual({
      status: "available",
      value: -100,
    });
  });

  it("marks percentages not applicable when the baseline denominator is zero", () => {
    const { baseline, alternative } = pair();
    alternative.totals.abandonments = 2;
    expect(
      metric(compareScenarios(baseline, alternative).totals!, "abandonments")
        .percentageDelta,
    ).toEqual({ status: "not_applicable", reason: "zero_baseline" });
  });

  it("keeps missing legacy modeled missed-sale values unavailable", () => {
    const { baseline, alternative } = pair();
    const comparison = compareScenarios(baseline, alternative);
    const vendor = comparison.vendors![0]!;

    expect(metric(vendor.metrics, "missedSaleCount")).toEqual({
      metric: "missedSaleCount",
      baseline: { status: "unavailable", reason: "metric_not_recorded" },
      alternative: { status: "unavailable", reason: "metric_not_recorded" },
      absoluteDelta: {
        status: "unavailable",
        reason: "source_value_unavailable",
      },
      percentageDelta: {
        status: "unavailable",
        reason: "source_value_unavailable",
      },
    });
    expect(comparison.compatibility.warnings).toContainEqual(
      expect.objectContaining({ code: "optional_metric_unavailable" }),
    );
  });

  it("compares recorded modeled missed-sale opportunities without relabeling them", () => {
    const { baseline, alternative } = pair();
    baseline.vendorMetrics[0]!.missedSales = { count: 2, value: 24 };
    alternative.vendorMetrics[0]!.missedSales = { count: 1, value: 12 };
    const vendor = compareScenarios(baseline, alternative).vendors![0]!;

    expect(metric(vendor.metrics, "missedSaleCount")).toMatchObject({
      baseline: { status: "available", value: 2 },
      alternative: { status: "available", value: 1 },
      absoluteDelta: { status: "available", value: -1 },
      percentageDelta: { status: "available", value: -50 },
    });
    expect(metric(vendor.metrics, "missedSaleValue")).toMatchObject({
      baseline: { value: 24 },
      alternative: { value: 12 },
    });
  });

  it("retains raw total, vendor, destination and transition values", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    alternative.vendorMetrics[0]!.visits = 5;
    alternative.destinationMetrics[0]!.completedDwellSeconds = 10;
    alternative.destinationTransitions[0]!.count = 4;
    alternative.totals.purchases = 4;
    const comparison = compareScenarios(baseline, alternative);

    expect(metric(comparison.totals!, "purchases")).toMatchObject({
      baseline: { value: 3 },
      alternative: { value: 4 },
      absoluteDelta: { value: 1 },
    });
    const food = comparison.vendors!.find(
      ({ vendorId }) => vendorId === "vendor-food",
    )!;
    expect(metric(food.metrics, "visits")).toMatchObject({
      baseline: { value: 2 },
      alternative: { value: 5 },
    });
    const foodDestination = comparison.destinations!.find(
      ({ destinationId }) => destinationId === "vendor-food",
    )!;
    expect(
      metric(foodDestination.metrics, "completedDwellSeconds"),
    ).toMatchObject({ baseline: { value: 4 }, alternative: { value: 10 } });
    const vendorTransition = comparison.destinationTransitions!.find(
      ({ fromType, toType }) => fromType === "vendor" && toType === "vendor",
    )!;
    expect(metric(vendorTransition.metrics, "count")).toMatchObject({
      baseline: { value: 1 },
      alternative: { value: 4 },
    });
  });

  it("preserves one-sided entities explicitly in stable ID order", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    alternative.vendorMetrics = [
      ...alternative.vendorMetrics.slice().reverse(),
      {
        ...alternative.vendorMetrics[0]!,
        vendorId: "vendor-added",
      },
    ];
    baseline.vendorMetrics = baseline.vendorMetrics.slice().reverse();
    const comparison = compareScenarios(baseline, alternative);

    expect(comparison.vendors!.map(({ vendorId }) => vendorId)).toEqual([
      "vendor-added",
      "vendor-drink",
      "vendor-expensive",
      "vendor-food",
    ]);
    const added = comparison.vendors![0]!;
    expect(added.presence).toBe("alternative_only");
    expect(metric(added.metrics, "purchases").baseline).toEqual({
      status: "unavailable",
      reason: "entity_absent",
    });
    expect(comparison.compatibility.warnings).toContainEqual(
      expect.objectContaining({
        code: "entity_only_on_one_side",
        path: "vendors.vendor-added",
      }),
    );
  });

  it("treats an absent sparse ANA-03 transition row as a raw zero count", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    alternative.destinationTransitions =
      alternative.destinationTransitions.filter(
        ({ fromType, toType }) =>
          !(fromType === "vendor" && toType === "vendor"),
      );
    const comparison = compareScenarios(baseline, alternative);
    const transition = comparison.destinationTransitions!.find(
      ({ fromType, toType }) => fromType === "vendor" && toType === "vendor",
    )!;

    expect(transition.presence).toBe("baseline_only");
    expect(metric(transition.metrics, "count")).toMatchObject({
      baseline: { status: "available", value: 1 },
      alternative: { status: "available", value: 0 },
      absoluteDelta: { status: "available", value: -1 },
      percentageDelta: { status: "available", value: -100 },
    });
    expect(comparison.compatibility.warnings).toContainEqual(
      expect.objectContaining({
        path: "destinationTransitions.vendor->vendor",
        message: expect.stringContaining("count is zero"),
      }),
    );
  });

  it("returns no fair-looking outcomes for every modeled settings mismatch", () => {
    const scalarMutations: Array<(result: SimulationResult) => void> = [
      (result) => void (result.settings.seed += 1),
      (result) => void (result.settings.attendeeCount += 1),
      (result) => void (result.settings.durationSeconds += 1),
      (result) => void (result.settings.stepSeconds += 0.5),
      (result) => void (result.settings.walkingSpeedMetersPerSecond += 0.1),
    ];
    const behaviorMutations: Array<(behavior: BehaviorSettings) => void> = [
      (behavior) => void (behavior.maximumItineraryStops += 1),
      (behavior) => void (behavior.maximumVendorStops += 1),
      (behavior) => void (behavior.maximumStageStops += 1),
      (behavior) => void (behavior.maximumAmenityStops += 1),
      (behavior) => void (behavior.maximumVisitsPerDestination += 1),
      (behavior) => void (behavior.roamingWaypoints += 1),
      (behavior) => void (behavior.queueToleranceMultiplier += 0.1),
      (behavior) => void (behavior.priceElasticity += 0.1),
      (behavior) =>
        void (behavior.deterministicExitProbabilityAfterStop += 0.01),
      (behavior) => void (behavior.minimumRemainingTimeSeconds += 1),
    ];
    for (const key of Object.keys(
      demoSimulationResult.settings.behavior.intentWeights,
    ) as Array<keyof BehaviorSettings["intentWeights"]>) {
      behaviorMutations.push(
        (behavior) => void (behavior.intentWeights[key] += 0.1),
      );
    }
    for (const key of Object.keys(
      demoSimulationResult.settings.behavior.destinationTypeWeights,
    ) as Array<keyof BehaviorSettings["destinationTypeWeights"]>) {
      behaviorMutations.push(
        (behavior) => void (behavior.destinationTypeWeights[key] += 0.1),
      );
    }
    for (const key of Object.keys(
      demoSimulationResult.settings.behavior.vendorCategoryWeights,
    ) as Array<keyof BehaviorSettings["vendorCategoryWeights"]>) {
      behaviorMutations.push(
        (behavior) => void (behavior.vendorCategoryWeights[key] += 0.1),
      );
    }
    for (const key of Object.keys(
      demoSimulationResult.settings.behavior.dwellDurationSeconds,
    ) as Array<keyof BehaviorSettings["dwellDurationSeconds"]>) {
      behaviorMutations.push(
        (behavior) => void (behavior.dwellDurationSeconds[key].minimum += 1),
        (behavior) => void (behavior.dwellDurationSeconds[key].maximum += 1),
      );
    }

    for (const mutate of scalarMutations) {
      const { baseline, alternative } = pair();
      mutate(alternative);
      const comparison = compareScenarios(baseline, alternative);
      expect(comparison.compatibility.status).toBe("incompatible");
      expect(comparison.totals).toBeNull();
    }
    for (const mutate of behaviorMutations) {
      const { baseline, alternative } = pair();
      mutate(alternative.settings.behavior);
      expect(compareScenarios(baseline, alternative).totals).toBeNull();
    }
  });

  it("detects every stable attendee-profile input mismatch", () => {
    const mutations: Array<(profile: AttendeeProfile) => void> = [
      (profile) => void (profile.id = "changed-id"),
      (profile) => void (profile.choiceStreamKey = "changed-stream"),
      (profile) => void (profile.entranceId = "changed-entrance"),
      (profile) => void (profile.spawnTimeSeconds += 1),
      (profile) => void (profile.intent = "explorer"),
      (profile) => void (profile.priceSensitivity += 0.1),
      (profile) => void (profile.queueToleranceSeconds += 1),
      (profile) => void (profile.walkingSpeedMultiplier += 0.1),
      (profile) => void (profile.stageAttractionPreference += 0.1),
      (profile) => void (profile.explorationTendency += 0.1),
      (profile) => void (profile.amenityTendency += 0.1),
      (profile) => void (profile.dwellDurationTendency += 0.1),
      (profile) => void (profile.exitTendency += 0.1),
      (profile) => void (profile.visitDurationToleranceSeconds += 1),
      (profile) => void (profile.initialBudget += 1),
    ];
    for (const key of Object.keys(
      demoSimulationResult.attendeeProfiles[0]!.destinationTypeWeights,
    ) as Array<keyof AttendeeProfile["destinationTypeWeights"]>) {
      mutations.push(
        (profile) => void (profile.destinationTypeWeights[key] += 0.1),
      );
    }
    for (const key of Object.keys(
      demoSimulationResult.attendeeProfiles[0]!.vendorCategoryWeights,
    ) as Array<keyof AttendeeProfile["vendorCategoryWeights"]>) {
      mutations.push(
        (profile) => void (profile.vendorCategoryWeights[key] += 0.1),
      );
    }

    for (const mutate of mutations) {
      const { baseline, alternative } = pair();
      mutate(alternative.attendeeProfiles[0]!);
      expect(
        assessScenarioCompatibility(baseline, alternative).errors,
      ).toContainEqual(
        expect.objectContaining({ code: "attendee_profiles_mismatch" }),
      );
    }
  });

  it("rejects missing, legacy or different model semantics", () => {
    const missing = pair();
    delete (missing.alternative as Partial<SimulationResult>).modelSemantics;
    expect(
      compareScenarios(missing.baseline, missing.alternative).compatibility
        .errors,
    ).toContainEqual(
      expect.objectContaining({ code: "missing_model_semantics" }),
    );

    const legacy = pair();
    Object.assign(legacy.alternative.modelSemantics, {
      queueDeparturePolicy: "exit_after_timeout",
    });
    expect(
      compareScenarios(legacy.baseline, legacy.alternative).totals,
    ).toBeNull();
  });

  it("rejects a legacy result without a festival snapshot cleanly", () => {
    const { baseline, alternative } = pair();
    delete (alternative as Partial<SimulationResult>).festival;
    const comparison = compareScenarios(baseline, alternative);

    expect(comparison.compatibility.errors).toContainEqual(
      expect.objectContaining({ code: "missing_festival_snapshot" }),
    );
    expect(comparison.totals).toBeNull();
  });

  it("rejects duplicate canonical result identities before producing deltas", () => {
    const { baseline, alternative } = pair();
    alternative.vendorMetrics.push(clone(alternative.vendorMetrics[0]!));
    const comparison = compareScenarios(baseline, alternative);

    expect(comparison.compatibility.errors).toContainEqual(
      expect.objectContaining({ code: "duplicate_result_entity" }),
    );
    expect(comparison.vendors).toBeNull();
  });

  it("checks non-layout festival assumptions while allowing layout and capacity edits", () => {
    const assumptionMutations: Array<(festival: Festival) => void> = [
      (festival) => void (festival.entrances[0]!.spawnWeight += 1),
      (festival) => void (festival.stages[0]!.attraction += 0.1),
      (festival) =>
        void (festival.stages[0]!.dwellDurationOverrideSeconds = {
          minimum: 1,
          maximum: 2,
        }),
      (festival) => void (festival.amenities![0]!.type = "seating"),
      (festival) => void (festival.amenities![0]!.attraction += 0.1),
      (festival) =>
        void (festival.amenities![0]!.dwellDurationOverrideSeconds = {
          minimum: 1,
          maximum: 2,
        }),
      (festival) => void (festival.vendors[0]!.category = "other"),
      (festival) => void (festival.vendors[0]!.popularity += 0.1),
      (festival) => void (festival.vendors[0]!.averagePrice += 1),
      (festival) => void (festival.vendors[0]!.serviceTimeSeconds += 1),
      (festival) => void (festival.vendors[0]!.inventory = 999),
    ];
    for (const mutate of assumptionMutations) {
      const { baseline, alternative } = pair(multiDestinationSimulationResult);
      mutate(alternative.festival);
      expect(compareScenarios(baseline, alternative).totals).toBeNull();
    }

    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    alternative.festival.vendors[0]!.position.x += 10;
    alternative.festival.vendors[0]!.size.width += 1;
    alternative.festival.vendors[0]!.servers += 1;
    alternative.festival.vendors[0]!.queueLimit = 20;
    alternative.festival.boundsMeters.width += 10;
    alternative.settings.frameIntervalSeconds = 5;
    expect(compareScenarios(baseline, alternative).compatibility.status).toBe(
      "compatible",
    );
  });

  it("does not mutate either input", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    const before = clone({ baseline, alternative });
    compareScenarios(baseline, alternative);
    expect({ baseline, alternative }).toEqual(before);
  });

  it("round-trips through JSON and repeats byte-for-byte", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    alternative.totals.revenue += 10;
    const first = compareScenarios(baseline, alternative);
    const serialized = JSON.stringify(first);

    expect(JSON.parse(serialized)).toEqual(first);
    expect(JSON.stringify(compareScenarios(baseline, alternative))).toBe(
      serialized,
    );
  });

  it("does not derive canonical results from frames, events or browser time", () => {
    const { baseline, alternative } = pair(multiDestinationSimulationResult);
    const expected = compareScenarios(baseline, alternative);
    alternative.frames = [];
    alternative.events = [];
    baseline.frames.reverse();
    baseline.events.reverse();

    expect(compareScenarios(baseline, alternative)).toEqual(expected);
  });

  it("compares a real moved and capacity-edited candidate with paired profiles", () => {
    const baselineFestival = clone(multiDestinationFestival);
    const candidateFestival = clone(multiDestinationFestival);
    const settings = clone(multiDestinationSimulationResult.settings);
    candidateFestival.vendors[0]!.position.x += 8;
    candidateFestival.vendors[0]!.servers += 1;
    candidateFestival.vendors[0]!.queueLimit = 20;

    const baseline = runSimulation(baselineFestival, settings);
    const alternative = runSimulation(candidateFestival, settings);
    const repeated = runSimulation(candidateFestival, settings);
    const comparison = compareScenarios(baseline, alternative);

    expect(alternative.attendeeProfiles).toEqual(baseline.attendeeProfiles);
    expect(repeated).toEqual(alternative);
    expect(comparison.compatibility.status).toBe("compatible");
    expect(comparison.totals).not.toBeNull();

    const savedSettings = clone(baseline.settings);
    const savedFestival = clone(baseline.festival);
    settings.behavior.dwellDurationSeconds.stage.minimum = 999;
    baselineFestival.vendors[0]!.averagePrice = 999;
    expect(baseline.settings).toEqual(savedSettings);
    expect(baseline.festival).toEqual(savedFestival);
  });
});
