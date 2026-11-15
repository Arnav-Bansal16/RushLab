import type {
  Festival,
  DestinationType,
  ObjectiveComponent,
  ObjectiveMetric,
  SimulationResult,
} from "../../domain";
export const OBJECTIVE = [
  {
    metric: "average_wait",
    direction: "lower",
    normalization: 60,
    weight: 0.2,
  },
  {
    metric: "abandonments_per_attendee",
    direction: "lower",
    normalization: 1,
    weight: 0.15,
  },
  {
    metric: "stockout_share",
    direction: "lower",
    normalization: 1,
    weight: 0.1,
  },
  {
    metric: "purchases_per_attendee",
    direction: "higher",
    normalization: 1,
    weight: 0.1,
  },
  {
    metric: "revenue_per_attendee",
    direction: "higher",
    normalization: 1,
    weight: 0.1,
  },
  {
    metric: "destination_coverage",
    direction: "higher",
    normalization: 1,
    weight: 0.1,
  },
  {
    metric: "frustration_per_attendee",
    direction: "lower",
    normalization: 1,
    weight: 0.1,
  },
  {
    metric: "missed_sale_value_per_attendee",
    direction: "lower",
    normalization: 1,
    weight: 0.15,
  },
] as const;
export type ObjectiveValues = Record<ObjectiveMetric, number | null>;
/** No new wait formula: weight canonical per-vendor mean by its service-start denominator. */
export function objectiveValues(result: SimulationResult): ObjectiveValues {
  const n = result.attendeeProfiles.length;
  const validVendorRows =
    result.vendorMetrics.length === result.festival.vendors.length &&
    result.festival.vendors.every((v) =>
      result.vendorMetrics.some((m) => m.vendorId === v.id),
    );
  let waits = 0,
    starts = 0;
  for (const v of result.vendorMetrics) {
    const count = result.events.filter(
      (e) => e.type === "service_start" && e.vendorId === v.vendorId,
    ).length;
    waits += v.averageWaitSeconds * count;
    starts += count;
  }
  const ext =
    result.modelSemantics?.missedSalePolicy ===
    "queue_departure_opportunity_v1";
  const attempts = result.events.filter((e) => e.type === "missed_sale");
  const missedAvailable =
    validVendorRows &&
    result.vendorMetrics.every(
      (v) =>
        v.missedSales !== undefined ||
        (ext &&
          !attempts.some(
            (e) => e.type === "missed_sale" && e.vendorId === v.vendorId,
          )),
    );
  const destinationCount =
    result.festival.vendors.length +
    result.festival.stages.length +
    (result.festival.amenities?.length ?? 0);
  const values: ObjectiveValues = {
    average_wait: validVendorRows && starts > 0 ? waits / starts : null,
    abandonments_per_attendee: n > 0 ? result.totals.abandonments / n : null,
    stockout_share:
      validVendorRows && result.vendorMetrics.length > 0
        ? result.vendorMetrics.filter((v) => v.stockoutTimeSeconds !== null)
            .length / result.vendorMetrics.length
        : null,
    purchases_per_attendee: n > 0 ? result.totals.purchases / n : null,
    revenue_per_attendee: n > 0 ? result.totals.revenue / n : null,
    destination_coverage:
      destinationCount > 0 && destinationEvidenceErrors(result).length === 0
        ? result.destinationMetrics.filter((d) => d.visits > 0).length /
          destinationCount
        : null,
    frustration_per_attendee: ext && n > 0 ? attempts.length / n : null,
    missed_sale_value_per_attendee:
      missedAvailable && n > 0
        ? result.vendorMetrics.reduce(
            (s, v) => s + (v.missedSales?.value ?? 0),
            0,
          ) / n
        : null,
  };
  for (const key of Object.keys(values) as ObjectiveMetric[])
    if (values[key] !== null && !Number.isFinite(values[key]))
      values[key] = null;
  return values;
}
export function scorePair(
  baseline: SimulationResult,
  alternative: SimulationResult,
  enabled: ReadonlySet<ObjectiveMetric>,
  festival: Festival,
): {
  components: ObjectiveComponent[];
  delta: number | null;
  reasons: string[];
} {
  const before = objectiveValues(baseline),
    after = objectiveValues(alternative);
  const weight = OBJECTIVE.filter((d) => enabled.has(d.metric)).reduce(
    (s, d) => s + d.weight,
    0,
  );
  const price = Math.max(
    1,
    festival.vendors.reduce((s, v) => s + v.averagePrice, 0) /
      Math.max(1, festival.vendors.length),
  );
  const reasons: string[] = [];
  const components: ObjectiveComponent[] = OBJECTIVE.map((d) => {
    const definition = {
      ...d,
      weight: enabled.has(d.metric) && weight > 0 ? d.weight / weight : 0,
      normalization:
        d.metric === "revenue_per_attendee" ||
        d.metric === "missed_sale_value_per_attendee"
          ? price
          : d.normalization,
    };
    if (!enabled.has(d.metric))
      return {
        ...definition,
        available: false,
        reason:
          "Unavailable in at least one baseline seed; omitted consistently for all candidates",
      };
    const b = before[d.metric],
      a = after[d.metric];
    if (b === null || a === null) {
      reasons.push(`Missing ${d.metric}`);
      return {
        ...definition,
        available: false,
        reason: "Expected canonical evidence is unavailable",
      };
    }
    return {
      ...definition,
      available: true,
      baseline: b,
      alternative: a,
      contribution:
        (((a - b) * (d.direction === "higher" ? 1 : -1)) /
          definition.normalization) *
          definition.weight +
        0,
    };
  });
  const delta = components.reduce(
    (s, c) => s + (c.available ? c.contribution : 0),
    0,
  );
  if (!weight) reasons.push("No common baseline objective evidence");
  if (!Number.isFinite(delta)) reasons.push("Non-finite objective");
  return { components, delta: reasons.length ? null : delta, reasons };
}

/** Share and coverage evidence requires every expected destination exactly once. */
export function destinationEvidenceErrors(result: SimulationResult): string[] {
  const expected: [string, DestinationType][] = [
    ...result.festival.vendors.map(
      (v) => [v.id, "vendor"] as [string, DestinationType],
    ),
    ...result.festival.stages.map(
      (v) => [v.id, "stage"] as [string, DestinationType],
    ),
    ...(result.festival.amenities ?? []).map(
      (v) => [v.id, v.type] as [string, DestinationType],
    ),
  ];
  const rows = result.destinationMetrics;
  if (
    rows.length !== expected.length ||
    new Set(rows.map((d) => d.destinationId)).size !== rows.length ||
    expected.some(
      ([id, type]) =>
        !rows.some((d) => d.destinationId === id && d.destinationType === type),
    )
  )
    return ["Incomplete destination summaries"];
  if (
    rows.some((d) =>
      [
        d.visits,
        d.uniqueVisitors,
        d.repeatVisits,
        d.completedDwellSeconds,
        d.truncatedDwellSeconds,
      ].some((v) => !Number.isFinite(v) || v < 0),
    )
  )
    return ["Invalid destination evidence"];
  return [];
}

/** Required canonical summaries must be complete; optional EXT-01 fields may be absent. */
export function incompleteEvidence(result: SimulationResult): string[] {
  const vendorIds = result.festival.vendors.map((v) => v.id).sort();

  const reasons: string[] = destinationEvidenceErrors(result);
  if (
    JSON.stringify(vendorIds) !==
    JSON.stringify(result.vendorMetrics.map((v) => v.vendorId).sort())
  )
    reasons.push("Incomplete vendor summaries");
  const values = [
    ...Object.values(result.totals),
    ...result.vendorMetrics.flatMap((v) => [
      v.visits,
      v.queueJoins,
      v.purchases,
      v.abandonments,
      v.revenue,
      v.averageWaitSeconds,
      v.maximumQueueLength,
      v.utilization,
      ...(v.stockoutTimeSeconds === null ? [] : [v.stockoutTimeSeconds]),
    ]),
    ...result.destinationMetrics.flatMap((d) => [
      d.visits,
      d.uniqueVisitors,
      d.repeatVisits,
      d.completedDwellSeconds,
      d.truncatedDwellSeconds,
    ]),
    ...result.destinationTransitions.map((t) => t.count),
  ];
  if (values.some((v) => !Number.isFinite(v) || v < 0))
    reasons.push("Invalid required canonical metric");
  return reasons;
}
