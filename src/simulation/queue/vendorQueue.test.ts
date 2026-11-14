import { describe, expect, it } from "vitest";
import type { Vendor } from "../../domain";
import {
  admitRequest,
  completePurchase,
  createVendorQueueState,
  hasQueueTimedOut,
  releaseServiceSlot,
  removeWaitingRequest,
  startNextRequest,
} from "./vendorQueue";

function vendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: "vendor-a",
    name: "Vendor A",
    category: "food",
    position: { x: 1, y: 1 },
    size: { width: 2, height: 2 },
    popularity: 1,
    averagePrice: 10,
    serviceTimeSeconds: 5,
    servers: 1,
    inventory: 10,
    queueLimit: 2,
    ...overrides,
  };
}

describe("vendor queue", () => {
  it("serves FIFO with attendee ID as the simultaneous tie-break", () => {
    const state = createVendorQueueState(vendor());
    expect(
      admitRequest(state, { attendeeId: "attendee-b", joinedAtSeconds: 2 }),
    ).toBe(true);
    expect(
      admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 2 }),
    ).toBe(true);

    expect(startNextRequest(state, 3, 8)?.attendeeId).toBe("attendee-a");
    expect(state.waiting.map(({ attendeeId }) => attendeeId)).toEqual([
      "attendee-b",
    ]);
  });

  it("respects queue limits while still allowing direct server admission", () => {
    const state = createVendorQueueState(vendor({ queueLimit: 1 }));
    expect(
      admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 0 }),
    ).toBe(true);
    expect(startNextRequest(state, 0, 5)).toBeDefined();
    expect(
      admitRequest(state, { attendeeId: "attendee-b", joinedAtSeconds: 0 }),
    ).toBe(true);
    expect(
      admitRequest(state, { attendeeId: "attendee-c", joinedAtSeconds: 0 }),
    ).toBe(false);

    expect(state.waiting).toHaveLength(1);
    expect(state.active).toHaveLength(1);
  });

  it("rejects duplicate membership and releases each slot once", () => {
    const state = createVendorQueueState(vendor());
    admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 0 });
    expect(() =>
      admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 0 }),
    ).toThrow(/already has a service request/);
    startNextRequest(state, 0, 5);
    expect(() =>
      admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 1 }),
    ).toThrow(/already has a service request/);

    expect(releaseServiceSlot(state, "attendee-a")).toBeDefined();
    expect(() => releaseServiceSlot(state, "attendee-a")).toThrow(
      /does not occupy/,
    );
  });

  it("uses the exact tolerance boundary for abandonment", () => {
    expect(hasQueueTimedOut(4, 13.999, 10)).toBe(false);
    expect(hasQueueTimedOut(4, 14, 10)).toBe(true);
  });

  it("keeps finite inventory non-negative and unlimited inventory unchanged", () => {
    const finite = createVendorQueueState(vendor({ inventory: 1 }));
    expect(completePurchase(finite)).toBe(true);
    expect(finite.inventoryRemaining).toBe(0);
    expect(() => completePurchase(finite)).toThrow(/after stockout/);

    const unlimited = createVendorQueueState(vendor({ inventory: null }));
    expect(completePurchase(unlimited)).toBe(false);
    expect(completePurchase(unlimited)).toBe(false);
    expect(unlimited.inventoryRemaining).toBeNull();
    expect(unlimited.cumulativeSales).toBe(2);
  });

  it("removes each waiting membership at most once", () => {
    const state = createVendorQueueState(vendor());
    admitRequest(state, { attendeeId: "attendee-a", joinedAtSeconds: 0 });
    expect(removeWaitingRequest(state, "attendee-a")).toBeDefined();
    expect(removeWaitingRequest(state, "attendee-a")).toBeUndefined();
    expect(state.waiting).toHaveLength(0);
  });
});
