import type {
  Id,
  SimulationEvent,
  SimulationResult,
  SimulationSettings,
  Vendor,
  VendorMetrics,
} from "../../domain";

type DerivedSimulationMetrics = Pick<
  SimulationResult,
  "vendorMetrics" | "totals"
>;

interface MutableVendorMetrics {
  missedSales?: { count: number; value: number };
  vendorId: Id;
  visits: number;
  queueJoins: number;
  purchases: number;
  abandonments: number;
  revenue: number;
  waitTotalSeconds: number;
  completedWaits: number;
  currentQueueLength: number;
  maximumQueueLength: number;
  busySeconds: number;
  activeServices: number;
  stockoutTimeSeconds: number | null;
}

interface WaitingMembership {
  vendorId: Id;
  joinedAtSeconds: number;
}

interface ActiveService {
  vendorId: Id;
  startedAtSeconds: number;
}

const FLOAT_TOLERANCE = 1e-9;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(`Invalid simulation event ledger: ${message}`);
}

function approximatelyEqual(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    FLOAT_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

export function deriveSimulationMetrics(
  events: SimulationEvent[],
  vendors: Vendor[],
  settings: SimulationSettings,
): DerivedSimulationMetrics {
  invariant(
    Number.isFinite(settings.durationSeconds) && settings.durationSeconds >= 0,
    "durationSeconds must be a finite non-negative number",
  );
  invariant(
    Number.isFinite(settings.stepSeconds) && settings.stepSeconds > 0,
    "stepSeconds must be a finite positive number",
  );
  const runEndSeconds =
    Math.floor(settings.durationSeconds / settings.stepSeconds) *
    settings.stepSeconds;

  const orderedVendors = [...vendors].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const vendorById = new Map<Id, Vendor>();
  const metricsByVendor = new Map<Id, MutableVendorMetrics>();

  for (const vendor of orderedVendors) {
    invariant(!vendorById.has(vendor.id), `duplicate vendor ${vendor.id}`);
    invariant(
      Number.isInteger(vendor.servers) && vendor.servers >= 0,
      `vendor ${vendor.id} has invalid server capacity`,
    );
    vendorById.set(vendor.id, vendor);
    metricsByVendor.set(vendor.id, {
      vendorId: vendor.id,
      visits: 0,
      queueJoins: 0,
      purchases: 0,
      abandonments: 0,
      revenue: 0,
      waitTotalSeconds: 0,
      completedWaits: 0,
      currentQueueLength: 0,
      maximumQueueLength: 0,
      busySeconds: 0,
      activeServices: 0,
      stockoutTimeSeconds: null,
    });
  }

  const waitingByAttendee = new Map<Id, WaitingMembership>();
  const serviceByAttendee = new Map<Id, ActiveService>();
  const exitedAttendees = new Set<Id>();
  let previousTimeSeconds = -Infinity;
  let totalPurchases = 0;
  let totalRevenue = 0;
  let totalAbandonments = 0;

  const vendorState = (vendorId: Id): MutableVendorMetrics => {
    const metrics = metricsByVendor.get(vendorId);
    invariant(metrics, `event references unknown vendor ${vendorId}`);
    return metrics;
  };

  const closeService = (
    attendeeId: Id,
    timeSeconds: number,
  ): ActiveService | undefined => {
    const service = serviceByAttendee.get(attendeeId);
    if (!service) return undefined;
    const metrics = vendorState(service.vendorId);
    const busySeconds = timeSeconds - service.startedAtSeconds;
    invariant(
      busySeconds >= -FLOAT_TOLERANCE,
      `service for attendee ${attendeeId} ends before it starts`,
    );
    metrics.busySeconds += Math.max(0, busySeconds);
    metrics.activeServices -= 1;
    invariant(
      metrics.activeServices >= 0,
      `vendor ${service.vendorId} has negative active service membership`,
    );
    serviceByAttendee.delete(attendeeId);
    return service;
  };

  for (const event of events) {
    invariant(
      Number.isFinite(event.timeSeconds) && event.timeSeconds >= 0,
      `${event.type} has an invalid timestamp`,
    );
    invariant(
      event.timeSeconds + FLOAT_TOLERANCE >= previousTimeSeconds,
      `${event.type} at ${event.timeSeconds} is out of order`,
    );
    invariant(
      event.timeSeconds <= settings.durationSeconds + FLOAT_TOLERANCE,
      `${event.type} occurs after the simulation duration`,
    );
    previousTimeSeconds = event.timeSeconds;

    if ("attendeeId" in event) {
      invariant(
        !exitedAttendees.has(event.attendeeId),
        `attendee ${event.attendeeId} transitions after exit`,
      );
    }

    switch (event.type) {
      case "missed_sale": {
        const metrics = vendorState(event.vendorId);
        invariant(
          Number.isFinite(event.missedSaleValue) && event.missedSaleValue >= 0,
          "invalid missed-sale value",
        );
        const missed = (metrics.missedSales ??= { count: 0, value: 0 });
        missed.count += 1;
        missed.value += event.missedSaleValue;
        break;
      }
      case "spawn":
        break;

      case "queue_join": {
        const metrics = vendorState(event.vendorId);
        invariant(
          !waitingByAttendee.has(event.attendeeId),
          `attendee ${event.attendeeId} has duplicate queue membership`,
        );
        invariant(
          !serviceByAttendee.has(event.attendeeId),
          `attendee ${event.attendeeId} joins a queue during active service`,
        );
        waitingByAttendee.set(event.attendeeId, {
          vendorId: event.vendorId,
          joinedAtSeconds: event.timeSeconds,
        });
        metrics.visits += 1;
        metrics.queueJoins += 1;
        metrics.currentQueueLength += 1;
        metrics.maximumQueueLength = Math.max(
          metrics.maximumQueueLength,
          metrics.currentQueueLength,
        );
        break;
      }

      case "queue_abandon": {
        const metrics = vendorState(event.vendorId);
        const waiting = waitingByAttendee.get(event.attendeeId);
        invariant(
          waiting?.vendorId === event.vendorId,
          `attendee ${event.attendeeId} abandons without matching queue membership`,
        );
        const waitedSeconds = event.timeSeconds - waiting.joinedAtSeconds;
        invariant(
          approximatelyEqual(event.waitedSeconds, waitedSeconds),
          `attendee ${event.attendeeId} has inconsistent abandonment wait`,
        );
        waitingByAttendee.delete(event.attendeeId);
        metrics.currentQueueLength -= 1;
        invariant(
          metrics.currentQueueLength >= 0,
          `vendor ${event.vendorId} has negative queue membership`,
        );
        metrics.abandonments += 1;
        totalAbandonments += 1;
        break;
      }

      case "service_start": {
        const metrics = vendorState(event.vendorId);
        const waiting = waitingByAttendee.get(event.attendeeId);
        invariant(
          waiting?.vendorId === event.vendorId,
          `attendee ${event.attendeeId} starts service without matching queue membership`,
        );
        invariant(
          !serviceByAttendee.has(event.attendeeId),
          `attendee ${event.attendeeId} has duplicate active service`,
        );
        invariant(
          metrics.activeServices < vendorById.get(event.vendorId)!.servers,
          `vendor ${event.vendorId} exceeds server capacity`,
        );
        waitingByAttendee.delete(event.attendeeId);
        metrics.currentQueueLength -= 1;
        invariant(
          metrics.currentQueueLength >= 0,
          `vendor ${event.vendorId} has negative queue membership`,
        );
        metrics.waitTotalSeconds += event.timeSeconds - waiting.joinedAtSeconds;
        metrics.completedWaits += 1;
        metrics.activeServices += 1;
        serviceByAttendee.set(event.attendeeId, {
          vendorId: event.vendorId,
          startedAtSeconds: event.timeSeconds,
        });
        break;
      }

      case "purchase": {
        const metrics = vendorState(event.vendorId);
        invariant(
          metrics.stockoutTimeSeconds === null,
          `vendor ${event.vendorId} records a purchase after stockout`,
        );
        invariant(
          Number.isFinite(event.amount),
          `purchase for attendee ${event.attendeeId} has a non-finite amount`,
        );
        const service = serviceByAttendee.get(event.attendeeId);
        invariant(
          service?.vendorId === event.vendorId,
          `attendee ${event.attendeeId} purchases without matching active service`,
        );
        closeService(event.attendeeId, event.timeSeconds);
        metrics.purchases += 1;
        metrics.revenue += event.amount;
        totalPurchases += 1;
        totalRevenue += event.amount;
        break;
      }

      case "stockout": {
        const metrics = vendorState(event.vendorId);
        if (metrics.stockoutTimeSeconds === null) {
          metrics.stockoutTimeSeconds = event.timeSeconds;
        }
        break;
      }

      case "exit": {
        const waiting = waitingByAttendee.get(event.attendeeId);
        const service = serviceByAttendee.get(event.attendeeId);
        invariant(
          (!waiting && !service) ||
            approximatelyEqual(event.timeSeconds, runEndSeconds),
          `attendee ${event.attendeeId} exits with an open request before the final fixed step`,
        );
        if (waiting) {
          const metrics = vendorState(waiting.vendorId);
          waitingByAttendee.delete(event.attendeeId);
          metrics.currentQueueLength -= 1;
          invariant(
            metrics.currentQueueLength >= 0,
            `vendor ${waiting.vendorId} has negative queue membership`,
          );
        }
        closeService(event.attendeeId, event.timeSeconds);
        exitedAttendees.add(event.attendeeId);
        break;
      }
    }
  }

  invariant(
    waitingByAttendee.size === 0,
    "run ended with unresolved queue membership",
  );
  invariant(
    serviceByAttendee.size === 0,
    "run ended with unresolved active service",
  );

  const vendorMetrics: VendorMetrics[] = orderedVendors.map((vendor) => {
    const metrics = metricsByVendor.get(vendor.id)!;
    const capacitySeconds = vendor.servers * settings.durationSeconds;
    const utilization =
      capacitySeconds === 0 ? 0 : metrics.busySeconds / capacitySeconds;
    invariant(
      utilization >= -FLOAT_TOLERANCE && utilization <= 1 + FLOAT_TOLERANCE,
      `vendor ${vendor.id} utilization is outside [0, 1]`,
    );

    return {
      vendorId: metrics.vendorId,
      ...(metrics.missedSales
        ? { missedSales: { ...metrics.missedSales } }
        : {}),
      visits: metrics.visits,
      queueJoins: metrics.queueJoins,
      purchases: metrics.purchases,
      abandonments: metrics.abandonments,
      revenue: metrics.revenue,
      averageWaitSeconds:
        metrics.completedWaits === 0
          ? 0
          : metrics.waitTotalSeconds / metrics.completedWaits,
      maximumQueueLength: metrics.maximumQueueLength,
      utilization: Math.min(1, Math.max(0, utilization)),
      stockoutTimeSeconds: metrics.stockoutTimeSeconds,
    };
  });

  return {
    vendorMetrics,
    totals: {
      purchases: totalPurchases,
      revenue: totalRevenue,
      abandonments: totalAbandonments,
      exitedAttendees: exitedAttendees.size,
    },
  };
}
