import type {
  DestinationComparison,
  DestinationMetricKey,
  DestinationMetrics,
  DestinationTransitionComparison,
  DestinationTransitionMetrics,
  EntityPresence,
  MetricUnavailableReason,
  NumericMetricComparison,
  NumericMetricValue,
  RunTotalMetricKey,
  ScenarioComparison,
  SimulationResult,
  VendorComparison,
  VendorMetricKey,
  VendorMetrics,
} from "../../domain";
import { assessScenarioCompatibility } from "./compatibility";

const RUN_TOTAL_KEYS: RunTotalMetricKey[] = [
  "purchases",
  "revenue",
  "abandonments",
  "exitedAttendees",
];
const VENDOR_KEYS: VendorMetricKey[] = [
  "visits",
  "queueJoins",
  "purchases",
  "abandonments",
  "revenue",
  "averageWaitSeconds",
  "maximumQueueLength",
  "utilization",
  "stockoutTimeSeconds",
  "missedSaleCount",
  "missedSaleValue",
];
const DESTINATION_KEYS: DestinationMetricKey[] = [
  "visits",
  "uniqueVisitors",
  "repeatVisits",
  "completedDwellSeconds",
  "truncatedDwellSeconds",
];

function available(value: number): NumericMetricValue {
  if (!Number.isFinite(value)) {
    throw new Error("Canonical comparison values must be finite numbers");
  }
  return { status: "available", value: Object.is(value, -0) ? 0 : value };
}

function unavailable(reason: MetricUnavailableReason): NumericMetricValue {
  return { status: "unavailable", reason };
}

function notApplicable(): NumericMetricValue {
  return { status: "not_applicable", reason: "no_stockout" };
}

function metricComparison<K extends string>(
  metric: K,
  baseline: NumericMetricValue,
  alternative: NumericMetricValue,
): NumericMetricComparison<K> {
  if (baseline.status === "available" && alternative.status === "available") {
    const delta = alternative.value - baseline.value;
    if (!Number.isFinite(delta)) {
      return {
        metric,
        baseline,
        alternative,
        absoluteDelta: { status: "unavailable", reason: "non_finite_result" },
        percentageDelta: {
          status: "unavailable",
          reason: "non_finite_result",
        },
      };
    }
    const percentage = (delta / baseline.value) * 100;
    return {
      metric,
      baseline,
      alternative,
      absoluteDelta: {
        status: "available",
        value: Object.is(delta, -0) ? 0 : delta,
      },
      percentageDelta:
        baseline.value === 0
          ? { status: "not_applicable", reason: "zero_baseline" }
          : Number.isFinite(percentage)
            ? {
                status: "available",
                value: percentage,
              }
            : { status: "unavailable", reason: "non_finite_result" },
    };
  }
  if (
    baseline.status === "not_applicable" ||
    alternative.status === "not_applicable"
  ) {
    return {
      metric,
      baseline,
      alternative,
      absoluteDelta: { status: "not_applicable", reason: "no_stockout" },
      percentageDelta: { status: "not_applicable", reason: "no_stockout" },
    };
  }
  return {
    metric,
    baseline,
    alternative,
    absoluteDelta: {
      status: "unavailable",
      reason: "source_value_unavailable",
    },
    percentageDelta: {
      status: "unavailable",
      reason: "source_value_unavailable",
    },
  };
}

function presence<T>(
  baseline: T | undefined,
  alternative: T | undefined,
): EntityPresence {
  if (baseline && alternative) return "both";
  return baseline ? "baseline_only" : "alternative_only";
}

function sideValue(
  value: number | undefined,
  entityExists: boolean,
): NumericMetricValue {
  return entityExists
    ? value === undefined
      ? unavailable("metric_not_recorded")
      : available(value)
    : unavailable("entity_absent");
}

function vendorValue(
  vendor: VendorMetrics | undefined,
  key: VendorMetricKey,
): NumericMetricValue {
  if (!vendor) return unavailable("entity_absent");
  if (key === "stockoutTimeSeconds") {
    return vendor.stockoutTimeSeconds === null
      ? notApplicable()
      : available(vendor.stockoutTimeSeconds);
  }
  if (key === "missedSaleCount") {
    return sideValue(vendor.missedSales?.count, true);
  }
  if (key === "missedSaleValue") {
    return sideValue(vendor.missedSales?.value, true);
  }
  return available(vendor[key]);
}

function compareVendors(
  baseline: VendorMetrics[],
  alternative: VendorMetrics[],
): VendorComparison[] {
  const baselineById = new Map(
    baseline.map((metric) => [metric.vendorId, metric]),
  );
  const alternativeById = new Map(
    alternative.map((metric) => [metric.vendorId, metric]),
  );
  const ids = [
    ...new Set([...baselineById.keys(), ...alternativeById.keys()]),
  ].sort();
  return ids.map((vendorId) => {
    const left = baselineById.get(vendorId);
    const right = alternativeById.get(vendorId);
    return {
      vendorId,
      presence: presence(left, right),
      metrics: VENDOR_KEYS.map((key) =>
        metricComparison(key, vendorValue(left, key), vendorValue(right, key)),
      ),
    };
  });
}

function compareDestinations(
  baseline: DestinationMetrics[],
  alternative: DestinationMetrics[],
): DestinationComparison[] {
  const baselineById = new Map(
    baseline.map((metric) => [metric.destinationId, metric]),
  );
  const alternativeById = new Map(
    alternative.map((metric) => [metric.destinationId, metric]),
  );
  const ids = [
    ...new Set([...baselineById.keys(), ...alternativeById.keys()]),
  ].sort();
  return ids.map((destinationId) => {
    const left = baselineById.get(destinationId);
    const right = alternativeById.get(destinationId);
    return {
      destinationId,
      destinationType: (left ?? right)!.destinationType,
      presence: presence(left, right),
      metrics: DESTINATION_KEYS.map((key) =>
        metricComparison(
          key,
          sideValue(left?.[key], Boolean(left)),
          sideValue(right?.[key], Boolean(right)),
        ),
      ),
    };
  });
}

function transitionKey(metric: DestinationTransitionMetrics): string {
  return `${metric.fromType}->${metric.toType}`;
}

function compareTransitions(
  baseline: DestinationTransitionMetrics[],
  alternative: DestinationTransitionMetrics[],
): DestinationTransitionComparison[] {
  const baselineById = new Map(
    baseline.map((metric) => [transitionKey(metric), metric]),
  );
  const alternativeById = new Map(
    alternative.map((metric) => [transitionKey(metric), metric]),
  );
  const ids = [
    ...new Set([...baselineById.keys(), ...alternativeById.keys()]),
  ].sort();
  return ids.map((id) => {
    const left = baselineById.get(id);
    const right = alternativeById.get(id);
    const source = (left ?? right)!;
    return {
      fromType: source.fromType,
      toType: source.toType,
      presence: presence(left, right),
      metrics: [
        metricComparison(
          "count",
          available(left?.count ?? 0),
          available(right?.count ?? 0),
        ),
      ],
    };
  });
}

/** Canonical final-result comparison. Frames and browser time are never read. */
export function compareScenarios(
  baseline: SimulationResult,
  alternative: SimulationResult,
): ScenarioComparison {
  const compatibility = assessScenarioCompatibility(baseline, alternative);
  const references = {
    baseline: { festivalId: baseline.festivalId, seed: baseline.settings.seed },
    alternative: {
      festivalId: alternative.festivalId,
      seed: alternative.settings.seed,
    },
  };
  if (compatibility.status === "incompatible") {
    return {
      ...references,
      compatibility,
      totals: null,
      vendors: null,
      destinations: null,
      destinationTransitions: null,
    };
  }

  return {
    ...references,
    compatibility,
    totals: RUN_TOTAL_KEYS.map((key) =>
      metricComparison(
        key,
        available(baseline.totals[key]),
        available(alternative.totals[key]),
      ),
    ),
    vendors: compareVendors(baseline.vendorMetrics, alternative.vendorMetrics),
    destinations: compareDestinations(
      baseline.destinationMetrics,
      alternative.destinationMetrics,
    ),
    destinationTransitions: compareTransitions(
      baseline.destinationTransitions,
      alternative.destinationTransitions,
    ),
  };
}
