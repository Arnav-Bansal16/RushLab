import type { SimulationResult } from "../../domain";
import { totalMissedSaleValue } from "./totalMissedSaleValue";

/** Presentation-only what-if targets. Never used for simulation, comparison or ranking. */
export function demoImprovementTargets(result: SimulationResult) {
  const lost = totalMissedSaleValue(result.vendorMetrics);
  const wait = result.vendorMetrics[0];
  return [
    {
      label: "Purchases",
      before: result.totals.purchases,
      after: Math.round(result.totals.purchases * 1.2),
      money: false,
    },
    {
      label: "Revenue (currency units)",
      before: result.totals.revenue,
      after: result.totals.revenue * 1.2,
      money: true,
    },
    {
      label: "Modeled sales lost (currency units)",
      before: lost,
      after: lost === undefined ? undefined : lost * 0.8,
      money: true,
    },
    {
      label: `Queue wait · ${result.festival.vendors.find((v) => v.id === wait?.vendorId)?.name ?? "vendor"} (seconds)`,
      before: wait?.averageWaitSeconds,
      after: wait === undefined ? undefined : wait.averageWaitSeconds * 0.8,
      money: false,
    },
  ];
}
