import { describe, expect, it } from "vitest";
import type { SimulationEvent, SimulationSettings, Vendor } from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { runSimulation } from "../../simulation";
import { deriveSimulationMetrics } from ".";

const settings: SimulationSettings = {
  seed: 1,
  attendeeCount: 4,
  durationSeconds: 100,
  stepSeconds: 1,
  frameIntervalSeconds: 1,
  walkingSpeedMetersPerSecond: 1,
};

function vendor(id: string, servers = 1): Vendor {
  return {
    id,
    name: id,
    category: "food",
    position: { x: 0, y: 0 },
    size: { width: 1, height: 1 },
    popularity: 1,
    averagePrice: 10,
    serviceTimeSeconds: 10,
    servers,
    inventory: null,
    queueLimit: null,
  };
}

describe("deriveSimulationMetrics", () => {
  it("returns complete zero metrics for every vendor in stable ID order", () => {
    const result = deriveSimulationMetrics(
      [],
      [vendor("vendor-z"), vendor("vendor-a"), vendor("vendor-m")],
      settings,
    );

    expect(result.vendorMetrics).toEqual(
      ["vendor-a", "vendor-m", "vendor-z"].map((vendorId) => ({
        vendorId,
        visits: 0,
        queueJoins: 0,
        purchases: 0,
        abandonments: 0,
        revenue: 0,
        averageWaitSeconds: 0,
        maximumQueueLength: 0,
        utilization: 0,
        stockoutTimeSeconds: null,
      })),
    );
    expect(result.totals).toEqual({
      purchases: 0,
      revenue: 0,
      abandonments: 0,
      exitedAttendees: 0,
    });
  });

  it("derives waits, queue maxima, purchases, abandonment, revenue, and totals from ordered transitions", () => {
    const events: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 1,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "queue_join",
        timeSeconds: 2,
        attendeeId: "attendee-b",
        vendorId: "vendor-a",
      },
      {
        type: "service_start",
        timeSeconds: 3,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "queue_abandon",
        timeSeconds: 7,
        attendeeId: "attendee-b",
        vendorId: "vendor-a",
        waitedSeconds: 5,
      },
      {
        type: "purchase",
        timeSeconds: 13,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
        amount: 12.5,
      },
      { type: "exit", timeSeconds: 14, attendeeId: "attendee-a" },
      { type: "exit", timeSeconds: 15, attendeeId: "attendee-b" },
    ];

    const result = deriveSimulationMetrics(
      events,
      [vendor("vendor-a")],
      settings,
    );

    expect(result.vendorMetrics[0]).toEqual({
      vendorId: "vendor-a",
      visits: 2,
      queueJoins: 2,
      purchases: 1,
      abandonments: 1,
      revenue: 12.5,
      averageWaitSeconds: 2,
      maximumQueueLength: 2,
      utilization: 0.1,
      stockoutTimeSeconds: null,
    });
    expect(result.totals).toEqual({
      purchases: 1,
      revenue: 12.5,
      abandonments: 1,
      exitedAttendees: 2,
    });
  });

  it("handles zero waits, overlapping servers, and run-end-truncated service", () => {
    const events: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 0,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "service_start",
        timeSeconds: 0,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "queue_join",
        timeSeconds: 10,
        attendeeId: "attendee-b",
        vendorId: "vendor-a",
      },
      {
        type: "service_start",
        timeSeconds: 10,
        attendeeId: "attendee-b",
        vendorId: "vendor-a",
      },
      {
        type: "purchase",
        timeSeconds: 30,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
        amount: 10,
      },
      { type: "exit", timeSeconds: 30, attendeeId: "attendee-a" },
      { type: "exit", timeSeconds: 100, attendeeId: "attendee-b" },
    ];

    const result = deriveSimulationMetrics(
      events,
      [vendor("vendor-a", 2)],
      settings,
    );

    expect(result.vendorMetrics[0]).toMatchObject({
      averageWaitSeconds: 0,
      maximumQueueLength: 1,
      utilization: 0.6,
    });
  });

  it("removes unresolved waiting membership on run-end exit", () => {
    const events: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 90,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      { type: "exit", timeSeconds: 100, attendeeId: "attendee-a" },
    ];

    expect(
      deriveSimulationMetrics(events, [vendor("vendor-a")], settings),
    ).toMatchObject({
      vendorMetrics: [
        {
          queueJoins: 1,
          abandonments: 0,
          maximumQueueLength: 1,
          utilization: 0,
        },
      ],
      totals: { exitedAttendees: 1 },
    });
  });

  it("uses the last fixed-step boundary for run-end cleanup", () => {
    const events: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 99,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      { type: "exit", timeSeconds: 100, attendeeId: "attendee-a" },
    ];

    expect(
      deriveSimulationMetrics(events, [vendor("vendor-a")], {
        ...settings,
        durationSeconds: 100.5,
        stepSeconds: 1,
      }),
    ).toMatchObject({
      vendorMetrics: [{ queueJoins: 1, maximumQueueLength: 1 }],
      totals: { exitedAttendees: 1 },
    });
  });

  it("uses the first stockout timestamp and rejects a later purchase", () => {
    const stockouts: SimulationEvent[] = [
      { type: "stockout", timeSeconds: 20, vendorId: "vendor-a" },
      { type: "stockout", timeSeconds: 21, vendorId: "vendor-a" },
    ];
    expect(
      deriveSimulationMetrics(stockouts, [vendor("vendor-a")], settings)
        .vendorMetrics[0]?.stockoutTimeSeconds,
    ).toBe(20);

    const purchaseAfterStockout: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 1,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "service_start",
        timeSeconds: 2,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      { type: "stockout", timeSeconds: 3, vendorId: "vendor-a" },
      {
        type: "purchase",
        timeSeconds: 4,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
        amount: 10,
      },
    ];
    expect(() =>
      deriveSimulationMetrics(
        purchaseAfterStockout,
        [vendor("vendor-a")],
        settings,
      ),
    ).toThrow(/purchase after stockout/);
  });

  it("returns zero utilization for zero duration and zero server capacity", () => {
    expect(
      deriveSimulationMetrics([], [vendor("vendor-a", 2)], {
        ...settings,
        durationSeconds: 0,
      }).vendorMetrics[0]?.utilization,
    ).toBe(0);
    expect(
      deriveSimulationMetrics([], [vendor("vendor-a", 0)], settings)
        .vendorMetrics[0]?.utilization,
    ).toBe(0);
  });

  it.each([
    {
      name: "duplicate queue membership",
      events: [
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "queue_join",
          timeSeconds: 2,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
      ],
      error: /duplicate queue membership/,
    },
    {
      name: "service without a queue join",
      events: [
        {
          type: "service_start",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
      ],
      error: /without matching queue membership/,
    },
    {
      name: "a second request during active service",
      events: [
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "service_start",
          timeSeconds: 2,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "queue_join",
          timeSeconds: 3,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
      ],
      error: /during active service/,
    },
    {
      name: "purchase without active service",
      events: [
        {
          type: "purchase",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
          amount: 10,
        },
      ],
      error: /without matching active service/,
    },
    {
      name: "abandonment without queue membership",
      events: [
        {
          type: "queue_abandon",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
          waitedSeconds: 1,
        },
      ],
      error: /without matching queue membership/,
    },
    {
      name: "inconsistent abandonment wait",
      events: [
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "queue_abandon",
          timeSeconds: 4,
          attendeeId: "a",
          vendorId: "vendor-a",
          waitedSeconds: 2,
        },
      ],
      error: /inconsistent abandonment wait/,
    },
    {
      name: "open request cleanup before run end",
      events: [
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        { type: "exit", timeSeconds: 99, attendeeId: "a" },
      ],
      error: /open request before the final fixed step/,
    },
    {
      name: "server over-capacity",
      vendors: [vendor("vendor-a", 1)],
      events: [
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "queue_join",
          timeSeconds: 1,
          attendeeId: "b",
          vendorId: "vendor-a",
        },
        {
          type: "service_start",
          timeSeconds: 2,
          attendeeId: "a",
          vendorId: "vendor-a",
        },
        {
          type: "service_start",
          timeSeconds: 2,
          attendeeId: "b",
          vendorId: "vendor-a",
        },
      ],
      error: /exceeds server capacity/,
    },
    {
      name: "out-of-order timestamps",
      events: [
        { type: "stockout", timeSeconds: 2, vendorId: "vendor-a" },
        { type: "stockout", timeSeconds: 1, vendorId: "vendor-a" },
      ],
      error: /out of order/,
    },
    {
      name: "unknown vendor",
      events: [
        { type: "stockout", timeSeconds: 1, vendorId: "vendor-missing" },
      ],
      error: /unknown vendor/,
    },
  ] satisfies Array<{
    name: string;
    events: SimulationEvent[];
    vendors?: Vendor[];
    error: RegExp;
  }>)("rejects $name", ({ events, vendors, error }) => {
    expect(() =>
      deriveSimulationMetrics(
        events,
        vendors ?? [vendor("vendor-a", 2)],
        settings,
      ),
    ).toThrow(error);
  });

  it("does not mutate inputs and returns JSON-serializable reconciled aggregates", () => {
    const events: SimulationEvent[] = [
      {
        type: "queue_join",
        timeSeconds: 1,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "service_start",
        timeSeconds: 2,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "purchase",
        timeSeconds: 5,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
        amount: 8,
      },
      { type: "exit", timeSeconds: 6, attendeeId: "attendee-a" },
    ];
    const vendors = [vendor("vendor-z"), vendor("vendor-a")];
    const eventsBefore = structuredClone(events);
    const vendorsBefore = structuredClone(vendors);
    const settingsBefore = structuredClone(settings);

    const result = deriveSimulationMetrics(events, vendors, settings);
    const vendorPurchases = result.vendorMetrics.reduce(
      (sum, metrics) => sum + metrics.purchases,
      0,
    );
    const vendorRevenue = result.vendorMetrics.reduce(
      (sum, metrics) => sum + metrics.revenue,
      0,
    );
    const vendorAbandonments = result.vendorMetrics.reduce(
      (sum, metrics) => sum + metrics.abandonments,
      0,
    );

    expect(vendorPurchases).toBe(result.totals.purchases);
    expect(vendorRevenue).toBe(result.totals.revenue);
    expect(vendorAbandonments).toBe(result.totals.abandonments);
    expect(events).toEqual(eventsBefore);
    expect(vendors).toEqual(vendorsBefore);
    expect(settings).toEqual(settingsBefore);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("integrates deterministically and is independent of frame contents", () => {
    const runSettings: SimulationSettings = {
      ...settings,
      seed: 20261114,
      attendeeCount: 12,
      durationSeconds: 180,
      walkingSpeedMetersPerSecond: 2,
    };
    const first = runSimulation(demoFestival, runSettings);
    const repeated = runSimulation(demoFestival, runSettings);
    const withoutFrames = { ...first, frames: [] };

    expect(repeated.vendorMetrics).toEqual(first.vendorMetrics);
    expect(repeated.totals).toEqual(first.totals);
    expect(
      deriveSimulationMetrics(
        withoutFrames.events,
        demoFestival.vendors,
        withoutFrames.settings,
      ),
    ).toEqual({
      vendorMetrics: first.vendorMetrics,
      totals: first.totals,
    });
  });
});
