import { expect, it } from "vitest";
import type { Festival, SimulationSettings } from "../domain";
import { runSimulation } from ".";

const festival: Festival = {
  schemaVersion: 1,
  id: "queue-retention",
  name: "Queue retention",
  boundsMeters: { width: 30, height: 20 },
  entrances: [
    { id: "entry", name: "Entry", position: { x: 1, y: 1 }, spawnWeight: 1 },
  ],
  stages: [],
  amenities: [],
  paths: [],
  obstacles: [],
  vendors: [
    {
      id: "slow",
      name: "Slow",
      position: { x: 1, y: 1 },
      size: { width: 1, height: 1 },
      category: "food",
      popularity: 5,
      averagePrice: 5,
      servers: 1,
      serviceTimeSeconds: 100,
      inventory: null,
      queueLimit: 1,
    },
    {
      id: "fast",
      name: "Fast",
      position: { x: 5, y: 1 },
      size: { width: 1, height: 1 },
      category: "food",
      popularity: 0.5,
      averagePrice: 3,
      servers: 10,
      serviceTimeSeconds: 1,
      inventory: null,
      queueLimit: 10,
    },
  ],
};
const settings: SimulationSettings = {
  seed: 42,
  attendeeCount: 50,
  durationSeconds: 180,
  stepSeconds: 0.5,
  frameIntervalSeconds: 0.5,
  walkingSpeedMetersPerSecond: 5,
  behavior: {
    maximumItineraryStops: 6,
    maximumVendorStops: 6,
    maximumStageStops: 0,
    maximumAmenityStops: 0,
    maximumVisitsPerDestination: 2,
    queueToleranceMultiplier: 0.05,
    minimumRemainingTimeSeconds: 0,
    deterministicExitProbabilityAfterStop: 0,
    roamingWaypoints: 0,
    intentWeights: {
      stage_first: 0,
      vendor_first: 1,
      explorer: 0,
      amenity_first: 0,
    },
  },
};
it("retains queue leavers, records reasons and opportunity amounts, and conserves queues and budgets", () => {
  const before = structuredClone({ festival, settings });
  const result = runSimulation(festival, settings);
  expect(runSimulation(festival, settings)).toEqual(result);
  expect({ festival, settings }).toEqual(before);
  const missed = result.events.filter((e) => e.type === "missed_sale");
  expect(new Set(missed.map((e) => e.reason))).toEqual(
    new Set(["wait_too_long", "queue_full"]),
  );
  expect(
    result.events.some(
      (e) => e.type === "exit" && e.reason === "queue_tolerance_exceeded",
    ),
  ).toBe(false);
  expect(
    missed.some((e) =>
      result.events.some(
        (p) =>
          p.type === "purchase" &&
          p.attendeeId === e.attendeeId &&
          p.timeSeconds > e.timeSeconds &&
          p.vendorId !== e.vendorId,
      ),
    ),
  ).toBe(true);
  for (const metric of result.vendorMetrics) {
    const opportunities = missed.filter((e) => e.vendorId === metric.vendorId);
    expect(metric.missedSales?.count ?? 0).toBe(opportunities.length);
    expect(metric.missedSales?.value ?? 0).toBe(
      opportunities.reduce((sum, e) => sum + e.missedSaleValue, 0),
    );
    expect(metric.revenue).toBe(
      result.events.reduce(
        (sum, e) =>
          sum +
          (e.type === "purchase" && e.vendorId === metric.vendorId
            ? e.amount
            : 0),
        0,
      ),
    );
  }
  expect(result.frames.some((f) => f.vendors.some((v) => v.queueFull))).toBe(
    true,
  );
  expect(
    result.frames.some((f) => f.attendees.some((a) => a.queueFrustration)),
  ).toBe(true);
  for (const frame of result.frames)
    for (const person of frame.attendees)
      if (person.queueFrustration) {
        expect(
          frame.timeSeconds - person.queueFrustration.timeSeconds,
        ).toBeLessThan(15);
        expect(person.queueFrustration.missedSaleValue).toBe(
          festival.vendors.find(
            (v) => v.id === person.queueFrustration!.vendorId,
          )!.averagePrice,
        );
      }
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});
