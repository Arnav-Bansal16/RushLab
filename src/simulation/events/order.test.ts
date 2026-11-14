import { describe, expect, it } from "vitest";
import type { SimulationEvent } from "../../domain";
import { compareSimulationEvents } from "./order";

describe("simulation event ordering", () => {
  it("uses causal type order, then stable vendor and attendee IDs", () => {
    const events: SimulationEvent[] = [
      {
        type: "service_start",
        timeSeconds: 5,
        attendeeId: "attendee-b",
        vendorId: "vendor-b",
      },
      {
        type: "queue_join",
        timeSeconds: 5,
        attendeeId: "attendee-b",
        vendorId: "vendor-a",
      },
      {
        type: "queue_join",
        timeSeconds: 5,
        attendeeId: "attendee-a",
        vendorId: "vendor-a",
      },
      {
        type: "purchase",
        timeSeconds: 5,
        attendeeId: "attendee-c",
        vendorId: "vendor-a",
        amount: 10,
      },
      { type: "stockout", timeSeconds: 5, vendorId: "vendor-a" },
    ];

    expect(
      events.sort(compareSimulationEvents).map(({ type }) => type),
    ).toEqual([
      "purchase",
      "stockout",
      "queue_join",
      "queue_join",
      "service_start",
    ]);
    expect(
      events
        .filter((event) => event.type === "queue_join")
        .map((event) => event.attendeeId),
    ).toEqual(["attendee-a", "attendee-b"]);
  });
});
