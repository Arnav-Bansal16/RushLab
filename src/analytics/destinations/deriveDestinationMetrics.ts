import type {
  DestinationMetrics,
  DestinationTransitionMetrics,
  DestinationType,
  Festival,
  SimulationEvent,
  SimulationResult,
} from "../../domain";

type VisitStart = Extract<SimulationEvent, { type: "destination_visit_start" }>;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(`Invalid destination event ledger: ${message}`);
}

const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

/** Reduce the supplied ledger in order; frames and runtime state are never inputs. */
export function deriveDestinationMetrics(
  events: readonly SimulationEvent[],
  festival: Festival,
): Pick<SimulationResult, "destinationMetrics" | "destinationTransitions"> {
  const metrics = new Map<string, DestinationMetrics>();
  const visitors = new Map<string, Set<string>>();
  const addDestination = (id: string, type: DestinationType) => {
    invariant(!metrics.has(id), `duplicate destination ${id}`);
    metrics.set(id, {
      destinationId: id,
      destinationType: type,
      visits: 0,
      uniqueVisitors: 0,
      repeatVisits: 0,
      completedDwellSeconds: 0,
      truncatedDwellSeconds: 0,
    });
    visitors.set(id, new Set());
  };
  festival.vendors.forEach((item) => addDestination(item.id, "vendor"));
  festival.stages.forEach((item) => addDestination(item.id, "stage"));
  (festival.amenities ?? []).forEach((item) =>
    addDestination(item.id, item.type),
  );

  const active = new Map<string, VisitStart>();
  const previous = new Map<string, VisitStart>();
  const truncatedAttendees = new Set<string>();
  const transitions = new Map<string, DestinationTransitionMetrics>();
  let previousTime = -Infinity;
  for (const event of events) {
    invariant(
      Number.isFinite(event.timeSeconds) && event.timeSeconds >= 0,
      `${event.type} has an invalid timestamp`,
    );
    invariant(
      event.timeSeconds >= previousTime,
      `${event.type} is out of order`,
    );
    previousTime = event.timeSeconds;
    if (
      event.type !== "destination_visit_start" &&
      event.type !== "destination_visit_end"
    )
      continue;
    const metric = metrics.get(event.destinationId);
    invariant(metric, `unknown destination ${event.destinationId}`);
    invariant(
      metric.destinationType === event.destinationType,
      "destination ID/type disagreement",
    );
    invariant(
      Number.isInteger(event.visitOrder) && event.visitOrder > 0,
      "invalid visit order",
    );

    if (event.type === "destination_visit_start") {
      invariant(
        !active.has(event.attendeeId),
        "duplicate or overlapping visit start",
      );
      invariant(
        !truncatedAttendees.has(event.attendeeId),
        "visit after truncated visit",
      );
      const last = previous.get(event.attendeeId);
      invariant(
        event.visitOrder === (last?.visitOrder ?? 0) + 1,
        "impossible visit order",
      );
      invariant(
        last?.destinationId !== event.destinationId,
        "immediate duplicate destination",
      );
      const seen = visitors.get(event.destinationId)!;
      const repeat = seen.has(event.attendeeId);
      invariant(
        event.isRepeatVisit === repeat,
        "inconsistent repeat-visit flag",
      );
      metric.visits += 1;
      metric.repeatVisits += Number(repeat);
      seen.add(event.attendeeId);
      metric.uniqueVisitors = seen.size;
      if (last) {
        const key = `${last.destinationType}:${event.destinationType}`;
        const transition = transitions.get(key) ?? {
          fromType: last.destinationType,
          toType: event.destinationType,
          count: 0,
        };
        transition.count += 1;
        transitions.set(key, transition);
      }
      active.set(event.attendeeId, event);
      previous.set(event.attendeeId, event);
    } else {
      const start = active.get(event.attendeeId);
      invariant(
        start &&
          start.destinationId === event.destinationId &&
          start.destinationType === event.destinationType &&
          start.visitOrder === event.visitOrder,
        "visit end without matching start",
      );
      const elapsed = event.timeSeconds - start.timeSeconds;
      invariant(
        Number.isFinite(event.durationSeconds) &&
          event.durationSeconds >= 0 &&
          Math.abs(event.durationSeconds - elapsed) <=
            1e-9 * Math.max(1, elapsed),
        "invalid or inconsistent visit duration",
      );
      invariant(typeof event.truncated === "boolean", "invalid truncated flag");
      const field = event.truncated
        ? "truncatedDwellSeconds"
        : "completedDwellSeconds";
      metric[field] += event.durationSeconds;
      invariant(Number.isFinite(metric[field]), "non-finite aggregate dwell");
      if (event.truncated) truncatedAttendees.add(event.attendeeId);
      active.delete(event.attendeeId);
    }
  }
  invariant(active.size === 0, "unresolved visits after ledger processing");
  return {
    destinationMetrics: [...metrics.values()].sort((a, b) =>
      compare(a.destinationId, b.destinationId),
    ),
    destinationTransitions: [...transitions.values()].sort(
      (a, b) => compare(a.fromType, b.fromType) || compare(a.toType, b.toType),
    ),
  };
}
