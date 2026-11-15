import { expect, it } from "vitest";
import { withBusinessSnapshots } from "./businessTimeline";
import type { SimulationEvent, SimulationFrame } from "../../domain";
import {
  createFestivalDemo,
  festivalDemoSettings,
} from "../../features/playback/vendorDemo";
import { runSimulation } from "../../simulation";
import {
  frameCursor,
  initialPlayback,
  playbackReducer,
} from "../../features/playback/controller";

it("records business values at exact event boundaries without future leakage or mutation", () => {
  const vendors = createFestivalDemo().vendors;
  const id = vendors[0].id;
  const frames: SimulationFrame[] = [0, 5, 10, 20].map((timeSeconds) => ({
    timeSeconds,
    attendees: [],
    vendors: [
      {
        vendorId: id,
        queueLength: 0,
        inventoryRemaining: null,
        cumulativeSales: 0,
      },
    ],
  }));
  const events: SimulationEvent[] = [
    {
      type: "purchase",
      timeSeconds: 5,
      attendeeId: "a",
      vendorId: id,
      amount: 5,
    },
    {
      type: "missed_sale",
      timeSeconds: 10,
      attendeeId: "b",
      vendorId: id,
      reason: "queue_full",
      missedSaleValue: 7,
    },
    {
      type: "purchase",
      timeSeconds: 20,
      attendeeId: "b",
      vendorId: id,
      amount: 3,
    },
  ];
  const before = structuredClone({ frames, events });
  const result = withBusinessSnapshots(events, frames, vendors);
  expect(
    result.map((f) => [
      f.vendors[0].cumulativeRevenue,
      f.vendors[0].cumulativeMissedSales,
      f.vendors[0].cumulativeMissedSaleValue,
    ]),
  ).toEqual([
    [0, 0, 0],
    [5, 0, 0],
    [5, 1, 7],
    [8, 1, 7],
  ]);
  expect({ frames, events }).toEqual(before);
});
it("restarts at zero and reconciles final frame with canonical real-run results", () => {
  const layout = createFestivalDemo();
  const result = runSimulation(layout, festivalDemoSettings);
  const original = structuredClone(result);
  const get = (time: number) => result.frames[frameCursor(result.frames, time)];
  for (const vendor of get(600).vendors) {
    const final = result.vendorMetrics.find(
      (m) => m.vendorId === vendor.vendorId,
    )!;
    expect(vendor.cumulativeRevenue).toBe(final.revenue);
    expect(vendor.cumulativeMissedSales).toBe(final.missedSales?.count ?? 0);
    expect(vendor.cumulativeMissedSaleValue).toBe(
      final.missedSales?.value ?? 0,
    );
  }
  let state = playbackReducer(result.frames, initialPlayback(result.frames), {
    type: "scrub",
    timeSeconds: 360,
  });
  state = playbackReducer(result.frames, state, { type: "restart" });
  expect(
    get(state.timeSeconds).vendors.every(
      (v) =>
        v.cumulativeRevenue === 0 &&
        v.cumulativeMissedSales === 0 &&
        v.cumulativeMissedSaleValue === 0,
    ),
  ).toBe(true);
  expect(runSimulation(layout, festivalDemoSettings)).toEqual(result);
  expect(result).toEqual(original);
});
