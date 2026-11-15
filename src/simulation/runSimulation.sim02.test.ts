import { describe, expect, it } from "vitest";
import type {
  Festival,
  SimulationEvent,
  SimulationResult,
  SimulationSettings,
  Vendor,
} from "../domain";
import { createNamedRandomStreams, runSimulation } from ".";
import { sampleServiceDurationSeconds } from "./runSimulation";

const baseVendor: Vendor = {
  id: "vendor-a",
  name: "Vendor A",
  category: "food",
  position: { x: 5, y: 1 },
  size: { width: 1, height: 1 },
  popularity: 1,
  averagePrice: 7.5,
  serviceTimeSeconds: 1,
  servers: 1,
  inventory: 20,
  queueLimit: 20,
};

function festival(vendorOverrides: Partial<Vendor> = {}): Festival {
  return {
    schemaVersion: 1,
    id: "festival-sim-02",
    name: "SIM-02 Festival",
    boundsMeters: { width: 20, height: 20 },
    entrances: [
      {
        id: "entrance-a",
        name: "Entrance A",
        position: { x: 1, y: 1 },
        spawnWeight: 1,
      },
    ],
    stages: [],
    paths: [],
    obstacles: [],
    vendors: [{ ...baseVendor, ...vendorOverrides }],
  };
}

function settings(
  overrides: Partial<SimulationSettings> = {},
): SimulationSettings {
  return {
    seed: 0,
    attendeeCount: 1,
    durationSeconds: 20,
    stepSeconds: 1,
    frameIntervalSeconds: 1,
    walkingSpeedMetersPerSecond: 2,
    behavior: {
      maximumItineraryStops: 1,
      maximumVendorStops: 1,
      maximumStageStops: 1,
      maximumAmenityStops: 1,
      minimumRemainingTimeSeconds: 0,
      deterministicExitProbabilityAfterStop: 0,
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

function expectFramesToReconcile(
  result: SimulationResult,
  sourceFestival: Festival,
): void {
  for (const frame of result.frames) {
    const waiting = new Map<string, Set<string>>(
      sourceFestival.vendors.map((vendor) => [vendor.id, new Set()]),
    );
    const active = new Map<string, Set<string>>(
      sourceFestival.vendors.map((vendor) => [vendor.id, new Set()]),
    );
    const sales = new Map(
      sourceFestival.vendors.map((vendor) => [vendor.id, 0]),
    );
    const inventory = new Map(
      sourceFestival.vendors.map((vendor) => [vendor.id, vendor.inventory]),
    );

    for (const event of result.events) {
      if (event.timeSeconds > frame.timeSeconds) break;
      if (event.type === "queue_join") {
        waiting.get(event.vendorId)!.add(event.attendeeId);
      } else if (event.type === "queue_abandon") {
        waiting.get(event.vendorId)!.delete(event.attendeeId);
      } else if (event.type === "service_start") {
        waiting.get(event.vendorId)!.delete(event.attendeeId);
        active.get(event.vendorId)!.add(event.attendeeId);
      } else if (event.type === "purchase") {
        active.get(event.vendorId)!.delete(event.attendeeId);
        sales.set(event.vendorId, sales.get(event.vendorId)! + 1);
        const remaining = inventory.get(event.vendorId);
        if (remaining !== null && remaining !== undefined) {
          inventory.set(event.vendorId, remaining - 1);
        }
      } else if (event.type === "exit") {
        for (const members of waiting.values())
          members.delete(event.attendeeId);
        for (const members of active.values()) members.delete(event.attendeeId);
      }
    }

    for (const vendorFrame of frame.vendors) {
      expect(vendorFrame.queueLength).toBe(
        waiting.get(vendorFrame.vendorId)!.size,
      );
      expect(vendorFrame.cumulativeSales).toBe(sales.get(vendorFrame.vendorId));
      expect(vendorFrame.inventoryRemaining).toBe(
        inventory.get(vendorFrame.vendorId),
      );
    }
  }
}

function expectConservation(result: SimulationResult): void {
  const joined = eventsOfType(result, "queue_join");
  const started = eventsOfType(result, "service_start");
  const purchased = eventsOfType(result, "purchase");
  const abandoned = eventsOfType(result, "queue_abandon");
  const exited = eventsOfType(result, "exit");

  expect(new Set(joined.map(({ attendeeId }) => attendeeId)).size).toBe(
    joined.length,
  );
  expect(new Set(started.map(({ attendeeId }) => attendeeId)).size).toBe(
    started.length,
  );
  expect(new Set(purchased.map(({ attendeeId }) => attendeeId)).size).toBe(
    purchased.length,
  );
  expect(new Set(exited.map(({ attendeeId }) => attendeeId)).size).toBe(
    exited.length,
  );

  for (const join of joined) {
    expect(
      result.events.some(
        (event) =>
          "attendeeId" in event &&
          event.attendeeId === join.attendeeId &&
          event.timeSeconds >= join.timeSeconds &&
          (event.type === "purchase" ||
            event.type === "queue_abandon" ||
            event.type === "exit"),
      ),
    ).toBe(true);
  }

  expect(result.totals.purchases).toBe(purchased.length);
  expect(result.totals.abandonments).toBe(abandoned.length);
  expect(result.totals.exitedAttendees).toBe(exited.length);
  expect(result.totals.revenue).toBe(
    purchased.reduce((sum, event) => sum + event.amount, 0),
  );
}

describe("runSimulation SIM-02 integration", () => {
  it("completes spawn → walk → queue → service → purchase → exit", () => {
    const result = runSimulation(festival(), settings());
    const eventTypes = result.events
      .map(({ type }) => type)
      .filter(
        (type) =>
          type !== "destination_visit_start" &&
          type !== "destination_visit_end",
      );

    expect(eventTypes).toEqual([
      "spawn",
      "queue_join",
      "service_start",
      "purchase",
      "exit",
    ]);
    expect(eventsOfType(result, "purchase")[0]?.amount).toBe(7.5);
    expect(
      new Set(
        result.frames.flatMap(({ attendees }) =>
          attendees.map(({ status }) => status),
        ),
      ),
    ).toEqual(
      new Set(["entering", "walking", "purchasing", "leaving", "exited"]),
    );
    expectConservation(result);
    expectFramesToReconcile(result, festival());
  });

  it("honors queue limits and excludes active service from queueLength", () => {
    const source = festival({
      position: { x: 1, y: 1 },
      servers: 1,
      serviceTimeSeconds: 15,
      queueLimit: 2,
      inventory: null,
    });
    const result = runSimulation(
      source,
      settings({ attendeeCount: 20, durationSeconds: 20 }),
    );

    expect(eventsOfType(result, "queue_join").length).toBeGreaterThanOrEqual(3);
    expect(eventsOfType(result, "service_start").length).toBeGreaterThanOrEqual(1);
    expect(
      Math.max(...result.frames.map((frame) => frame.vendors[0]!.queueLength)),
    ).toBe(2);
    expectConservation(result);
    expectFramesToReconcile(result, source);
  });

  it("increases throughput with two servers under identical demand", () => {
    const commonSettings = settings({
      attendeeCount: 40,
      durationSeconds: 30,
      walkingSpeedMetersPerSecond: 10,
    });
    const oneServer = runSimulation(
      festival({
        position: { x: 1, y: 1 },
        servers: 1,
        serviceTimeSeconds: 4,
        inventory: null,
        queueLimit: null,
      }),
      commonSettings,
    );
    const twoServers = runSimulation(
      festival({
        position: { x: 1, y: 1 },
        servers: 2,
        serviceTimeSeconds: 4,
        inventory: null,
        queueLimit: null,
      }),
      commonSettings,
    );

    expect(twoServers.totals.purchases).toBeGreaterThan(
      oneServer.totals.purchases,
    );
    expectConservation(oneServer);
    expectConservation(twoServers);
  });

  it("decrements finite inventory once, stocks out once, and never oversells", () => {
    const source = festival({
      position: { x: 1, y: 1 },
      servers: 2,
      serviceTimeSeconds: 1,
      inventory: 2,
      queueLimit: null,
    });
    const result = runSimulation(
      source,
      settings({ attendeeCount: 30, durationSeconds: 30 }),
    );
    const purchases = eventsOfType(result, "purchase");
    const stockouts = eventsOfType(result, "stockout");

    expect(purchases).toHaveLength(2);
    expect(stockouts).toHaveLength(1);
    expect(
      purchases.every(
        (event) => event.timeSeconds <= stockouts[0]!.timeSeconds,
      ),
    ).toBe(true);
    expect(
      result.frames.every(
        (frame) => frame.vendors[0]!.inventoryRemaining! >= 0,
      ),
    ).toBe(true);
    expect(result.frames.at(-1)?.vendors[0]).toMatchObject({
      inventoryRemaining: 0,
      cumulativeSales: 2,
    });
    expectConservation(result);
    expectFramesToReconcile(result, source);
  });

  it("keeps unlimited inventory null while recording every completed sale", () => {
    const source = festival({
      position: { x: 1, y: 1 },
      serviceTimeSeconds: 1,
      servers: 2,
      inventory: null,
      queueLimit: null,
    });
    const result = runSimulation(
      source,
      settings({ attendeeCount: 20, durationSeconds: 30 }),
    );
    const purchases = eventsOfType(result, "purchase");

    expect(purchases.length).toBeGreaterThan(2);
    expect(eventsOfType(result, "stockout")).toHaveLength(0);
    expect(
      result.frames.every(
        (frame) => frame.vendors[0]!.inventoryRemaining === null,
      ),
    ).toBe(true);
    expect(result.frames.at(-1)?.vendors[0]?.cumulativeSales).toBe(
      purchases.length,
    );
    expectFramesToReconcile(result, source);
  });

  it("abandons a waiting request on its exact tolerance boundary", () => {
    const source = festival({
      position: { x: 1, y: 1 },
      servers: 0,
      inventory: null,
      queueLimit: null,
    });
    const result = runSimulation(
      source,
      settings({
        seed: 2,
        attendeeCount: 1,
        durationSeconds: 400,
        stepSeconds: 0.01,
        frameIntervalSeconds: 1,
        walkingSpeedMetersPerSecond: 10,
      }),
    );
    const join = eventsOfType(result, "queue_join")[0]!;
    const abandon = eventsOfType(result, "queue_abandon")[0]!;
    const tolerance = result.attendeeProfiles[0]!.queueToleranceSeconds;
    expect(abandon.timeSeconds - join.timeSeconds).toBeCloseTo(tolerance, 10);
    expect(abandon.waitedSeconds).toBeCloseTo(tolerance, 10);
    expect(eventsOfType(result, "service_start")).toHaveLength(0);
    expectFramesToReconcile(result, source);
  });

  it("preserves service-stream independence", () => {
    const untouched = createNamedRandomStreams(77);
    const movementConsumed = createNamedRandomStreams(77);
    for (let index = 0; index < 500; index += 1) {
      movementConsumed.movement.float();
      movementConsumed.choice.float();
    }

    expect(
      sampleServiceDurationSeconds(10, 0.5, movementConsumed.service),
    ).toBe(sampleServiceDurationSeconds(10, 0.5, untouched.service));
    expect(movementConsumed.profiles.float()).toBe(untouched.profiles.float());
    expect(movementConsumed.arrivals.float()).toBe(untouched.arrivals.float());
  });

  it.each([0, 1, 42, 77, 20261114])(
    "preserves all queue, inventory, frame, and serialization invariants for seed %i",
    (seed) => {
      const source = festival({
        servers: 2,
        serviceTimeSeconds: 3,
        inventory: 12,
        queueLimit: 4,
      });
      const runSettings = settings({
        seed,
        attendeeCount: 25,
        durationSeconds: 40,
      });
      const festivalBefore = structuredClone(source);
      const settingsBefore = structuredClone(runSettings);
      const result = runSimulation(source, runSettings);

      expectConservation(result);
      expectFramesToReconcile(result, source);
      expect(source).toEqual(festivalBefore);
      expect(runSettings).toEqual(settingsBefore);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      expect(
        result.events.every(
          (event, index) =>
            index === 0 ||
            event.timeSeconds >= result.events[index - 1]!.timeSeconds,
        ),
      ).toBe(true);
      expect(
        result.frames.every(
          (frame, index) =>
            index === 0 ||
            frame.timeSeconds > result.frames[index - 1]!.timeSeconds,
        ),
      ).toBe(true);
      expect(
        result.frames
          .flatMap(({ attendees }) => attendees)
          .every(
            ({ position }) =>
              position.x >= 0 &&
              position.x <= source.boundsMeters.width &&
              position.y >= 0 &&
              position.y <= source.boundsMeters.height,
          ),
      ).toBe(true);
    },
  );

  it("is same-seed equal and different-seed unequal for full SIM-02 results", () => {
    const source = festival({ servers: 2, inventory: null, queueLimit: null });
    const runSettings = settings({ attendeeCount: 12, durationSeconds: 30 });
    const first = runSimulation(source, runSettings);
    const repeated = runSimulation(source, runSettings);
    const different = runSimulation(source, { ...runSettings, seed: 99 });

    expect(repeated).toEqual(first);
    expect(different.attendeeProfiles).not.toEqual(first.attendeeProfiles);
    expect(different.events).not.toEqual(first.events);
    expect(different.frames).not.toEqual(first.frames);
  });
});
