import type { VendorMetrics } from "../../domain";

/** Absent vendor evidence must not be interpreted as zero missed opportunities. */
export function totalMissedSaleValue(
  metrics: readonly VendorMetrics[],
): number | undefined {
  if (metrics.some((metric) => metric.missedSales === undefined))
    return undefined;
  return metrics.reduce(
    (total, metric) => total + metric.missedSales!.value,
    0,
  );
}
