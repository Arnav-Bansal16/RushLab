import type { SimulationEvent } from "../../domain";

const EVENT_PRIORITY: Record<SimulationEvent["type"], number> = {
  spawn: 0,
  destination_visit_start: 1,
  purchase: 2,
  stockout: 3,
  queue_abandon: 4,
  queue_join: 5,
  service_start: 6,
  destination_visit_end: 7,
  exit: 8,
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
