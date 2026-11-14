import type { Id, Vendor } from "../../domain";

export interface QueueEntry {
  attendeeId: Id;
  joinedAtSeconds: number;
}

export interface ServiceSlot {
  attendeeId: Id;
  startedAtSeconds: number;
  completesAtSeconds: number;
}

export interface VendorQueueState {
  vendorId: Id;
  queueLimit: number | null;
  serverCount: number;
  inventoryRemaining: number | null;
  cumulativeSales: number;
  stockoutEmitted: boolean;
  waiting: QueueEntry[];
  active: ServiceSlot[];
}

export function createVendorQueueState(vendor: Vendor): VendorQueueState {
  if (!Number.isInteger(vendor.servers) || vendor.servers < 0) {
    throw new Error(
      `Vendor ${vendor.id} must have a non-negative server count`,
    );
  }
  if (
    vendor.queueLimit !== null &&
    (!Number.isInteger(vendor.queueLimit) || vendor.queueLimit < 0)
  ) {
    throw new Error(`Vendor ${vendor.id} must have a valid queue limit`);
  }
  if (
    vendor.inventory !== null &&
    (!Number.isInteger(vendor.inventory) || vendor.inventory < 0)
  ) {
    throw new Error(`Vendor ${vendor.id} must have valid inventory`);
  }

  return {
    vendorId: vendor.id,
    queueLimit: vendor.queueLimit,
    serverCount: vendor.servers,
    inventoryRemaining: vendor.inventory,
    cumulativeSales: 0,
    stockoutEmitted: vendor.inventory === 0,
    waiting: [],
    active: [],
  };
}

function containsAttendee(state: VendorQueueState, attendeeId: Id): boolean {
  return (
    state.waiting.some((entry) => entry.attendeeId === attendeeId) ||
    state.active.some((slot) => slot.attendeeId === attendeeId)
  );
}

export function hasServiceInventory(state: VendorQueueState): boolean {
  return (
    state.inventoryRemaining === null ||
    state.active.length < state.inventoryRemaining
  );
}

export function canAdmitRequest(state: VendorQueueState): boolean {
  if (state.inventoryRemaining === 0) return false;

  const canEnterServiceDirectly =
    state.active.length + state.waiting.length < state.serverCount &&
    (state.inventoryRemaining === null ||
      state.active.length + state.waiting.length < state.inventoryRemaining);
  return (
    canEnterServiceDirectly ||
    state.queueLimit === null ||
    state.waiting.length < state.queueLimit
  );
}

export function admitRequest(
  state: VendorQueueState,
  entry: QueueEntry,
): boolean {
  if (containsAttendee(state, entry.attendeeId)) {
    throw new Error(
      `Attendee ${entry.attendeeId} already has a service request`,
    );
  }
  if (!canAdmitRequest(state)) return false;

  state.waiting.push(entry);
  state.waiting.sort(
    (left, right) =>
      left.joinedAtSeconds - right.joinedAtSeconds ||
      left.attendeeId.localeCompare(right.attendeeId),
  );
  return true;
}

export function removeWaitingRequest(
  state: VendorQueueState,
  attendeeId: Id,
): QueueEntry | undefined {
  const index = state.waiting.findIndex(
    (entry) => entry.attendeeId === attendeeId,
  );
  if (index < 0) return undefined;
  return state.waiting.splice(index, 1)[0];
}

export function hasQueueTimedOut(
  joinedAtSeconds: number,
  timeSeconds: number,
  toleranceSeconds: number,
): boolean {
  return timeSeconds - joinedAtSeconds + 1e-9 >= toleranceSeconds;
}

export function startNextRequest(
  state: VendorQueueState,
  startedAtSeconds: number,
  completesAtSeconds: number,
): ServiceSlot | undefined {
  if (state.active.length >= state.serverCount || !hasServiceInventory(state)) {
    return undefined;
  }
  const entry = state.waiting.shift();
  if (!entry) return undefined;

  const slot = {
    attendeeId: entry.attendeeId,
    startedAtSeconds,
    completesAtSeconds,
  };
  state.active.push(slot);
  state.active.sort((left, right) =>
    left.attendeeId.localeCompare(right.attendeeId),
  );
  return slot;
}

export function releaseServiceSlot(
  state: VendorQueueState,
  attendeeId: Id,
): ServiceSlot {
  const index = state.active.findIndex(
    (slot) => slot.attendeeId === attendeeId,
  );
  if (index < 0) {
    throw new Error(`Attendee ${attendeeId} does not occupy a service slot`);
  }
  const [slot] = state.active.splice(index, 1);
  if (!slot) throw new Error("Unable to release service slot");
  return slot;
}

export function completePurchase(state: VendorQueueState): boolean {
  if (state.inventoryRemaining !== null) {
    if (state.inventoryRemaining <= 0) {
      throw new Error(`Vendor ${state.vendorId} cannot sell after stockout`);
    }
    state.inventoryRemaining -= 1;
  }
  state.cumulativeSales += 1;

  if (state.inventoryRemaining === 0 && !state.stockoutEmitted) {
    state.stockoutEmitted = true;
    return true;
  }
  return false;
}
