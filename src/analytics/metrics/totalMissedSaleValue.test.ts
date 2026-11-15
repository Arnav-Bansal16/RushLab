import { expect, it } from "vitest";
import { totalMissedSaleValue } from "./totalMissedSaleValue";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";

it("sums supplied missed-sale values without mutating inputs and preserves unavailable evidence", () => {
  const base = demoSimulationResult.vendorMetrics[0];
  const metrics = Object.freeze([
    Object.freeze({ ...base, missedSales: { count: 2, value: 24 } }),
    Object.freeze({
      ...base,
      vendorId: "other",
      missedSales: { count: 1, value: 7 },
    }),
  ]);
  expect(totalMissedSaleValue(metrics)).toBe(31);
  expect(totalMissedSaleValue([...metrics, base])).toBeUndefined();
  expect(
    totalMissedSaleValue([{ ...base, missedSales: { count: 0, value: 0 } }]),
  ).toBe(0);
  expect(totalMissedSaleValue([])).toBe(0);
});
