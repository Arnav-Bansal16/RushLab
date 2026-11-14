import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SimulationResult } from "../../domain";
import { executeRun } from "./run";
import { createVendorDemo, vendorDemoSettings } from "./vendorDemo";
import { frameCursor, initialPlayback, playbackReducer } from "./controller";
import { FrameDetails } from "./FrameDetails";

function run(seed = 42, overrides = {}) {
  const layout = createVendorDemo();
  const before = structuredClone(layout);
  const outcome = executeRun(layout, {
    ...vendorDemoSettings,
    seed,
    ...overrides,
  });
  if (!outcome.ok) throw new Error(outcome.errors.join(" "));
  expect(layout).toEqual(before);
  return outcome.run;
}

/** Independent assertions in tests only. Production UI never reconstructs events. */
function reconcile(
  result: SimulationResult,
  startingInventory: Map<string, number | null>,
) {
  const waiting = new Map(
    [...startingInventory.keys()].map((id) => [id, new Set<string>()]),
  );
  const active = new Map(
    [...startingInventory.keys()].map((id) => [id, new Set<string>()]),
  );
  const inventory = new Map(startingInventory),
    sales = new Map([...inventory.keys()].map((id) => [id, 0]));
  let cursor = 0;
  for (const frame of result.frames) {
    while (
      cursor < result.events.length &&
      result.events[cursor].timeSeconds <= frame.timeSeconds
    ) {
      const event = result.events[cursor++];
      if (event.type === "queue_join")
        waiting.get(event.vendorId)!.add(event.attendeeId);
      if (event.type === "service_start") {
        waiting.get(event.vendorId)!.delete(event.attendeeId);
        active.get(event.vendorId)!.add(event.attendeeId);
      }
      if (event.type === "queue_abandon")
        waiting.get(event.vendorId)!.delete(event.attendeeId);
      if (event.type === "purchase") {
        active.get(event.vendorId)!.delete(event.attendeeId);
        sales.set(event.vendorId, sales.get(event.vendorId)! + 1);
        const remaining = inventory.get(event.vendorId)!;
        if (remaining !== null) inventory.set(event.vendorId, remaining - 1);
      }
      if (event.type === "exit")
        for (const set of [...waiting.values(), ...active.values()])
          set.delete(event.attendeeId);
    }
    for (const vendor of frame.vendors) {
      expect(vendor.queueLength).toBe(waiting.get(vendor.vendorId)!.size);
      expect(vendor.cumulativeSales).toBe(sales.get(vendor.vendorId));
      expect(vendor.inventoryRemaining).toBe(inventory.get(vendor.vendorId));
      const inService = frame.attendees.filter(
        (person) =>
          person.status === "purchasing" &&
          person.targetVendorId === vendor.vendorId,
      );
      expect(inService.length).toBe(active.get(vendor.vendorId)!.size);
    }
  }
}

describe("SIM-02 to UI-02 combined handoff", () => {
  it.each([42, 7, 99])(
    "reconciles every displayed vendor state against the real ledger for seed %s",
    (seed) => {
      const snapshot = run(seed);
      reconcile(
        snapshot.result,
        new Map(
          snapshot.festivalSnapshot.vendors.map((vendor) => [
            vendor.id,
            vendor.inventory,
          ]),
        ),
      );
      expect(JSON.parse(JSON.stringify(snapshot.result))).toEqual(
        snapshot.result,
      );
      const statuses = new Set(
        snapshot.result.frames.flatMap((frame) =>
          frame.attendees.map((person) => person.status),
        ),
      );
      expect(
        ([
          "entering",
          "walking",
          "queued",
          "purchasing",
          "leaving",
          "exited",
        ] as const).every((status) => statuses.has(status)),
      ).toBe(true);
      expect(
        [...statuses].every((status) =>
          [
            "entering",
            "choosing",
            "walking",
            "roaming",
            "queued",
            "purchasing",
            "dwelling",
            "leaving",
            "exited",
          ].includes(status),
        ),
      ).toBe(true);
      expect(
        snapshot.result.events.some((event) => event.type === "purchase"),
      ).toBe(true);
      expect(
        snapshot.result.events.some((event) => event.type === "queue_abandon"),
      ).toBe(true);
    },
  );
  it("shows changing sales, finite inventory, unlimited inventory, and stockouts from real frames", () => {
    const { result, festivalSnapshot } = run();
    const stockout = result.events.find((event) => event.type === "stockout");
    expect(stockout).toBeDefined();
    if (!stockout || stockout.type !== "stockout")
      throw new Error("No stockout in example");
    const atStockout = result.frames.find(
      (frame) => frame.timeSeconds >= stockout.timeSeconds,
    )!;
    const vendor = atStockout.vendors.find(
      (state) => state.vendorId === stockout.vendorId,
    )!;
    expect(vendor.inventoryRemaining).toBe(0);
    expect(vendor.cumulativeSales).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      createElement(FrameDetails, {
        festival: festivalSnapshot,
        frame: atStockout,
        playing: true,
        inspectedId: "",
        onInspect: () => {},
      }),
    );
    expect(html).toContain("Out of stock");
    expect(html).toContain("Unlimited");
    expect(html).toContain("Live playback");
    expect(
      result.events
        .slice(result.events.indexOf(stockout) + 1)
        .some(
          (event) =>
            event.type === "purchase" && event.vendorId === stockout.vendorId,
        ),
    ).toBe(false);
    expect(
      result.frames.some((frame) =>
        frame.vendors.some((state) => state.queueLength > 0),
      ),
    ).toBe(true);
  });
  it("keeps deterministic output and immutable playback when actual commerce is present", () => {
    const first = run(),
      second = run();
    expect(first.result).toEqual(second.result);
    const before = structuredClone(first);
    let state = playbackReducer(
      first.result.frames,
      initialPlayback(first.result.frames),
      { type: "play" },
    );
    state = playbackReducer(first.result.frames, state, {
      type: "advance",
      elapsedSeconds: 60,
    });
    state = playbackReducer(first.result.frames, state, {
      type: "scrub",
      timeSeconds: 120,
    });
    const selected =
      first.result.frames[frameCursor(first.result.frames, state.timeSeconds)];
    renderToStaticMarkup(
      createElement(FrameDetails, {
        festival: first.festivalSnapshot,
        frame: selected,
        playing: false,
        inspectedId: "",
        onInspect: () => {},
      }),
    );
    expect(first).toEqual(before);
  });
  it("stops at the last sparse recorded frame rather than requested duration", () => {
    const snapshot = run(42, {
      durationSeconds: 183.25,
      frameIntervalSeconds: 7,
    });
    const frames = snapshot.result.frames,
      last = frames.at(-1)!;
    expect(last.timeSeconds).toBeLessThan(
      snapshot.settingsSnapshot.durationSeconds,
    );
    let state = playbackReducer(frames, initialPlayback(frames), {
      type: "play",
    });
    state = playbackReducer(frames, state, {
      type: "advance",
      elapsedSeconds: 999,
    });
    expect(state.timeSeconds).toBe(last.timeSeconds);
    expect(frameCursor(frames, state.timeSeconds)).toBe(frames.length - 1);
    reconcile(
      snapshot.result,
      new Map(
        snapshot.festivalSnapshot.vendors.map((vendor) => [
          vendor.id,
          vendor.inventory,
        ]),
      ),
    );
  });
});
