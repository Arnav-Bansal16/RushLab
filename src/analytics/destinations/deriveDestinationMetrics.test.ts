import { describe, expect, it } from "vitest";
import type {
  Festival,
  SimulationEvent,
  SimulationSettings,
} from "../../domain";
import {
  multiDestinationFestival,
  multiDestinationSimulationResult,
} from "../../fixtures/multiDestination";
import { runSimulation } from "../../simulation";
import { deriveSimulationMetrics } from "../metrics";
import { deriveDestinationMetrics } from ".";

const festival: Festival = {
  ...structuredClone(multiDestinationFestival),
  amenities: [
    ...multiDestinationFestival.amenities,
    {
      ...multiDestinationFestival.amenities[0],
      id: "seating",
      type: "seating",
    },
    {
      ...multiDestinationFestival.amenities[0],
      id: "first-aid",
      type: "first_aid",
    },
  ],
};
type Start = Extract<SimulationEvent, { type: "destination_visit_start" }>;
type End = Extract<SimulationEvent, { type: "destination_visit_end" }>;
function start(timeSeconds = 0, overrides: Partial<Start> = {}): Start {
  return {
    type: "destination_visit_start",
    timeSeconds,
    attendeeId: "a",
    destinationId: "stage-main",
    destinationType: "stage",
    visitOrder: 1,
    isRepeatVisit: false,
    ...overrides,
  };
}
function end(timeSeconds = 10, overrides: Partial<End> = {}): End {
  return {
    type: "destination_visit_end",
    timeSeconds,
    attendeeId: "a",
    destinationId: "stage-main",
    destinationType: "stage",
    visitOrder: 1,
    durationSeconds: timeSeconds,
    truncated: false,
    ...overrides,
  };
}
const settings: SimulationSettings = {
  seed: 42,
  attendeeCount: 30,
  durationSeconds: 300,
  stepSeconds: 0.5,
  frameIntervalSeconds: 2,
  walkingSpeedMetersPerSecond: 3,
  behavior: {
    maximumVisitsPerDestination: 2,
    deterministicExitProbabilityAfterStop: 0,
    minimumRemainingTimeSeconds: 0,
  },
};

function freeze(value: unknown) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

describe("destination analytics", () => {
  it("agrees with the shared fixture values independently of illustrative array order", () => {
    const result = deriveDestinationMetrics(
      multiDestinationSimulationResult.events,
      multiDestinationFestival,
    );
    expect(result.destinationMetrics).toEqual(
      [...multiDestinationSimulationResult.destinationMetrics].sort((a, b) =>
        a.destinationId.localeCompare(b.destinationId),
      ),
    );
    expect(result.destinationTransitions).toEqual(
      [...multiDestinationSimulationResult.destinationTransitions].sort(
        (a, b) =>
          a.fromType.localeCompare(b.fromType) ||
          a.toType.localeCompare(b.toType),
      ),
    );
  });

  it("reconciles run-end dwell at the last fixed step of a fractional duration", () => {
    const shortFestival = structuredClone(festival);
    shortFestival.stages = [
      {
        ...shortFestival.stages[0],
        position: { ...shortFestival.entrances[0].position },
        dwellDurationOverrideSeconds: { minimum: 0, maximum: 100 },
      },
    ];
    const result = runSimulation(shortFestival, {
      ...settings,
      durationSeconds: 10.25,
      behavior: {
        ...settings.behavior,
        roamingWaypoints: 0,
        destinationTypeWeights: {
          stage: 1,
          vendor: 0,
          restroom: 0,
          seating: 0,
          first_aid: 0,
        },
      },
    });
    const ends = result.events.filter(
      (e): e is End => e.type === "destination_visit_end",
    );
    expect(ends.length).toBeGreaterThan(0);
    expect(ends.some((e) => e.truncated && e.timeSeconds === 10)).toBe(true);
    expect(
      result.destinationMetrics.find(
        (m) => m.destinationId === shortFestival.stages[0].id,
      ),
    ).toMatchObject({
      completedDwellSeconds: 0,
      truncatedDwellSeconds: ends.reduce(
        (sum, e) => sum + e.durationSeconds,
        0,
      ),
    });
  });

  it("includes all canonical zero-visit destinations in stable ID order", () => {
    const result = deriveDestinationMetrics([], festival);
    const ids = [
      ...festival.vendors,
      ...festival.stages,
      ...festival.amenities!,
    ]
      .map((d) => d.id)
      .sort();
    expect(result.destinationMetrics.map((m) => m.destinationId)).toEqual(ids);
    expect(result.destinationMetrics).toEqual(
      ids.map((destinationId) => ({
        destinationId,
        destinationType: festival.vendors.some((d) => d.id === destinationId)
          ? "vendor"
          : festival.stages.some((d) => d.id === destinationId)
            ? "stage"
            : festival.amenities!.find((d) => d.id === destinationId)!.type,
        visits: 0,
        uniqueVisitors: 0,
        repeatVisits: 0,
        completedDwellSeconds: 0,
        truncatedDwellSeconds: 0,
      })),
    );
    expect(result.destinationTransitions).toEqual([]);
    expect(
      deriveDestinationMetrics([], {
        ...festival,
        vendors: [],
        stages: [],
        amenities: [],
      }),
    ).toEqual({ destinationMetrics: [], destinationTransitions: [] });
  });

  it("supports missing amenities", () => {
    const legacy = structuredClone(festival);
    delete legacy.amenities;
    expect(
      deriveDestinationMetrics([], legacy).destinationMetrics,
    ).toHaveLength(festival.vendors.length + festival.stages.length);
  });

  it.each([0, 10])(
    "handles first/last completed and truncated boundaries of %s seconds",
    (duration) => {
      for (const truncated of [false, true]) {
        const result = deriveDestinationMetrics(
          [start(), end(duration, { truncated })],
          festival,
        );
        expect(
          result.destinationMetrics.find(
            (m) => m.destinationId === "stage-main",
          ),
        ).toMatchObject({
          visits: 1,
          uniqueVisitors: 1,
          repeatVisits: 0,
          completedDwellSeconds: truncated ? 0 : duration,
          truncatedDwellSeconds: truncated ? duration : 0,
        });
      }
    },
  );

  it.each(festival.amenities!)(
    "uses actual amenity type $type and completed dwell",
    (amenity) => {
      const target = {
        destinationId: amenity.id,
        destinationType: amenity.type,
      };
      const result = deriveDestinationMetrics(
        [start(5, target), end(12, { ...target, durationSeconds: 7 })],
        festival,
      );
      expect(
        result.destinationMetrics.find((m) => m.destinationId === amenity.id),
      ).toMatchObject({
        destinationType: amenity.type,
        visits: 1,
        completedDwellSeconds: 7,
      });
    },
  );

  it("counts repeats, unique visitors and attendee-local transitions in visit order", () => {
    const restroom = {
      destinationId: "amenity-restroom",
      destinationType: "restroom" as const,
    };
    const events = [
      start(),
      start(0, { attendeeId: "b", ...restroom }),
      end(2, { attendeeId: "b", ...restroom }),
      end(3),
      start(4, { ...restroom, visitOrder: 2 }),
      start(4, { attendeeId: "b", visitOrder: 2 }),
      end(5, { ...restroom, visitOrder: 2, durationSeconds: 1 }),
      end(5, { attendeeId: "b", visitOrder: 2, durationSeconds: 1 }),
      start(5, { visitOrder: 3, isRepeatVisit: true }),
      end(8, { visitOrder: 3, durationSeconds: 3 }),
    ];
    const result = deriveDestinationMetrics(events, festival);
    expect(
      result.destinationMetrics.find((m) => m.destinationId === "stage-main"),
    ).toMatchObject({
      visits: 3,
      uniqueVisitors: 2,
      repeatVisits: 1,
      completedDwellSeconds: 7,
    });
    expect(result.destinationTransitions).toEqual([
      { fromType: "restroom", toType: "stage", count: 2 },
      { fromType: "stage", toType: "restroom", count: 1 },
    ]);
    const reversed = {
      ...festival,
      stages: [...festival.stages].reverse(),
      vendors: [...festival.vendors].reverse(),
      amenities: [...festival.amenities!].reverse(),
    };
    expect(deriveDestinationMetrics(events, reversed)).toEqual(result);
  });

  const malformed: Array<[string, SimulationEvent[]]> = [
    ["NaN timestamp", [start(NaN)]],
    ["infinite timestamp", [start(Infinity)]],
    ["negative timestamp", [start(-1)]],
    ["out of order", [start(2), end(1)]],
    ["unknown destination", [start(0, { destinationId: "missing" })]],
    ["wrong type", [start(0, { destinationType: "vendor" })]],
    ["duplicate start", [start(), start()]],
    ["end only", [end()]],
    ["unresolved start", [start()]],
    ["wrong attendee", [start(), end(10, { attendeeId: "b" })]],
    ["wrong destination", [start(), end(10, { destinationId: "stage-side" })]],
    ["wrong end type", [start(), end(10, { destinationType: "vendor" })]],
    ["wrong end order", [start(), end(10, { visitOrder: 2 })]],
    ["invalid order", [start(0, { visitOrder: 0 })]],
    ["fractional order", [start(0, { visitOrder: 1.5 })]],
    ["skipped order", [start(0, { visitOrder: 2 })]],
    ["invalid duration", [start(), end(10, { durationSeconds: NaN })]],
    ["negative duration", [start(), end(10, { durationSeconds: -1 })]],
    ["inconsistent duration", [start(), end(10, { durationSeconds: 9 })]],
    ["false repeat", [start(0, { isRepeatVisit: true })]],
    [
      "immediate duplicate",
      [start(), end(), start(11, { visitOrder: 2, isRepeatVisit: true })],
    ],
    ["duplicate end", [start(), end(), end()]],
    [
      "visit after truncation",
      [
        start(),
        end(10, { truncated: true }),
        start(11, { visitOrder: 2, destinationId: "stage-side" }),
      ],
    ],
    [
      "incorrect repeat on return",
      [
        start(),
        end(),
        start(11, { destinationId: "stage-side", visitOrder: 2 }),
        end(12, {
          destinationId: "stage-side",
          visitOrder: 2,
          durationSeconds: 1,
        }),
        start(13, { visitOrder: 3 }),
      ],
    ],
  ];
  it.each(malformed)("rejects %s", (_, events) => {
    expect(() => deriveDestinationMetrics(events, festival)).toThrow(
      /Invalid destination event ledger/,
    );
  });

  it("rejects duplicate canonical IDs", () => {
    expect(() =>
      deriveDestinationMetrics([], {
        ...festival,
        stages: [...festival.stages, festival.stages[0]],
      }),
    ).toThrow(/duplicate destination/);
  });

  it("preserves frozen inputs and serializes outputs", () => {
    const input = structuredClone({ festival, events: [start(), end()] });
    const before = structuredClone(input);
    freeze(input);
    const result = deriveDestinationMetrics(input.events, input.festival);
    expect(input).toEqual(before);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it.each([1, 42, 20261114])(
    "reconciles real engine output and preserves ANA-01 metrics for seed %s",
    (seed) => {
      const input = structuredClone({
        festival,
        settings: { ...settings, seed },
      });
      const before = structuredClone(input);
      freeze(input);
      const result = runSimulation(input.festival, input.settings);
      const repeated = runSimulation(input.festival, input.settings);
      expect(repeated.destinationMetrics).toEqual(result.destinationMetrics);
      expect(repeated.destinationTransitions).toEqual(
        result.destinationTransitions,
      );
      expect(input).toEqual(before);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      for (const metric of result.destinationMetrics) {
        const starts = result.events.filter(
          (e): e is Start =>
            e.type === "destination_visit_start" &&
            e.destinationId === metric.destinationId,
        );
        const ends = result.events.filter(
          (e): e is End =>
            e.type === "destination_visit_end" &&
            e.destinationId === metric.destinationId,
        );
        expect(metric).toMatchObject({
          visits: starts.length,
          uniqueVisitors: new Set(starts.map((e) => e.attendeeId)).size,
          repeatVisits: starts.filter((e) => e.isRepeatVisit).length,
          completedDwellSeconds: ends
            .filter((e) => !e.truncated)
            .reduce((sum, e) => sum + e.durationSeconds, 0),
          truncatedDwellSeconds: ends
            .filter((e) => e.truncated)
            .reduce((sum, e) => sum + e.durationSeconds, 0),
        });
      }
      const expected = new Map<string, number>();
      for (const profile of result.attendeeProfiles) {
        const visits = result.events
          .filter(
            (e): e is Start =>
              e.type === "destination_visit_start" &&
              e.attendeeId === profile.id,
          )
          .sort((a, b) => a.visitOrder - b.visitOrder);
        visits.slice(1).forEach((visit, i) => {
          const key = `${visits[i].destinationType}:${visit.destinationType}`;
          expected.set(key, (expected.get(key) ?? 0) + 1);
        });
      }
      expect(
        result.destinationTransitions.map((t) => [
          `${t.fromType}:${t.toType}`,
          t.count,
        ]),
      ).toEqual([...expected].sort(([a], [b]) => a.localeCompare(b)));
      expect(deriveDestinationMetrics(result.events, input.festival)).toEqual({
        destinationMetrics: result.destinationMetrics,
        destinationTransitions: result.destinationTransitions,
      });
      expect(
        deriveSimulationMetrics(
          result.events,
          input.festival.vendors,
          result.settings,
        ),
      ).toEqual({ vendorMetrics: result.vendorMetrics, totals: result.totals });
      expect(result.totals.purchases).toBe(
        result.events.filter((e) => e.type === "purchase").length,
      );
    },
  );
});
