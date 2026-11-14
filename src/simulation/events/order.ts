import type { SimulationEvent } from "../../domain";

const EVENT_PRIORITY: Record<SimulationEvent["type"], number> = {
  spawn: 0,
  purchase: 1,
  stockout: 2,
  queue_abandon: 3,
  queue_join: 4,
  service_start: 5,
  exit: 6,
};

function vendorId(event: SimulationEvent): string {
  return "vendorId" in event ? event.vendorId : "";
}

function attendeeId(event: SimulationEvent): string {
  return "attendeeId" in event ? event.attendeeId : "";
}

export function compareSimulationEvents(
  left: SimulationEvent,
  right: SimulationEvent,
): number {
  return (
    left.timeSeconds - right.timeSeconds ||
    EVENT_PRIORITY[left.type] - EVENT_PRIORITY[right.type] ||
    vendorId(left).localeCompare(vendorId(right)) ||
    attendeeId(left).localeCompare(attendeeId(right))
  );
}

export function appendOrderedEvents(
  ledger: SimulationEvent[],
  events: SimulationEvent[],
): void {
  ledger.push(...events.sort(compareSimulationEvents));
}
