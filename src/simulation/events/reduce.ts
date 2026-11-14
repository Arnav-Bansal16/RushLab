import type {
  Id,
  SimulationEvent,
  SimulationSettings,
  Vendor,
  VendorMetrics,
} from "../../domain";

interface MutableVendorMetrics extends VendorMetrics {
  waitTotalSeconds: number;
  busySeconds: number;
  queueLength: number;
  serviceStarts: number;
}

export function reduceSimulationEvents(
  events: SimulationEvent[],
  vendors: Vendor[],
  settings: SimulationSettings,
): {
  vendorMetrics: VendorMetrics[];
  totals: {
    purchases: number;
    revenue: number;
    abandonments: number;
    exitedAttendees: number;
  };
} {
  const byVendor = new Map<Id, MutableVendorMetrics>(
    vendors.map((vendor) => [
      vendor.id,
      {
        vendorId: vendor.id,
        visits: 0,
        queueJoins: 0,
        purchases: 0,
        abandonments: 0,
        revenue: 0,
        averageWaitSeconds: 0,
        maximumQueueLength: 0,
        utilization: 0,
        stockoutTimeSeconds: null,
        waitTotalSeconds: 0,
        busySeconds: 0,
        queueLength: 0,
        serviceStarts: 0,
      },
    ]),
  );
  const queueJoinedAt = new Map<string, number>();
  const serviceStartedAt = new Map<string, number>();
  const key = (vendorId: Id, attendeeId: Id) =>
    `${vendorId}\u0000${attendeeId}`;

  let purchases = 0;
  let revenue = 0;
  let abandonments = 0;
  let exitedAttendees = 0;

  for (const event of events) {
    if (event.type === "exit") {
      exitedAttendees += 1;
      for (const [serviceKey, startedAt] of serviceStartedAt) {
        if (serviceKey.endsWith(`\u0000${event.attendeeId}`)) {
          const vendorId = serviceKey.split("\u0000")[0];
          const metrics = vendorId ? byVendor.get(vendorId) : undefined;
          if (metrics) metrics.busySeconds += event.timeSeconds - startedAt;
          serviceStartedAt.delete(serviceKey);
        }
      }
      continue;
    }
    if (!("vendorId" in event)) continue;
    const metrics = byVendor.get(event.vendorId);
    if (!metrics) continue;

    if (event.type === "queue_join") {
      metrics.visits += 1;
      metrics.queueJoins += 1;
      metrics.queueLength += 1;
      metrics.maximumQueueLength = Math.max(
        metrics.maximumQueueLength,
        metrics.queueLength,
      );
      queueJoinedAt.set(
        key(event.vendorId, event.attendeeId),
        event.timeSeconds,
      );
    } else if (event.type === "queue_abandon") {
      metrics.abandonments += 1;
      metrics.queueLength -= 1;
      abandonments += 1;
      queueJoinedAt.delete(key(event.vendorId, event.attendeeId));
    } else if (event.type === "service_start") {
      const requestKey = key(event.vendorId, event.attendeeId);
      const joinedAt = queueJoinedAt.get(requestKey);
      metrics.queueLength -= 1;
      if (joinedAt !== undefined) {
        metrics.waitTotalSeconds += event.timeSeconds - joinedAt;
      }
      queueJoinedAt.delete(requestKey);
      serviceStartedAt.set(requestKey, event.timeSeconds);
      metrics.serviceStarts += 1;
    } else if (event.type === "purchase") {
      const requestKey = key(event.vendorId, event.attendeeId);
      const startedAt = serviceStartedAt.get(requestKey);
      if (startedAt !== undefined) {
        metrics.busySeconds += event.timeSeconds - startedAt;
      }
      serviceStartedAt.delete(requestKey);
      metrics.purchases += 1;
      metrics.revenue += event.amount;
      purchases += 1;
      revenue += event.amount;
    } else if (event.type === "stockout") {
      metrics.stockoutTimeSeconds ??= event.timeSeconds;
    }
  }

  const vendorMetrics = vendors.map((vendor) => {
    const metrics = byVendor.get(vendor.id)!;
    return {
      vendorId: metrics.vendorId,
      visits: metrics.visits,
      queueJoins: metrics.queueJoins,
      purchases: metrics.purchases,
      abandonments: metrics.abandonments,
      revenue: metrics.revenue,
      averageWaitSeconds:
        metrics.serviceStarts === 0
          ? 0
          : metrics.waitTotalSeconds / metrics.serviceStarts,
      maximumQueueLength: metrics.maximumQueueLength,
      utilization:
        vendor.servers === 0 || settings.durationSeconds === 0
          ? 0
          : metrics.busySeconds / (vendor.servers * settings.durationSeconds),
      stockoutTimeSeconds: metrics.stockoutTimeSeconds,
    };
  });

  return {
    vendorMetrics,
    totals: { purchases, revenue, abandonments, exitedAttendees },
  };
}
