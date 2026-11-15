import { expect, it } from "vitest";
import { demoImprovementTargets } from "./demoTargets";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
it("keeps illustrative 20% targets separate from immutable simulated results", () => {
  const result = structuredClone(demoSimulationResult);
  result.totals.purchases = 100;
  result.totals.revenue = 200;
  result.vendorMetrics[0].averageWaitSeconds = 50;
  const before = JSON.stringify(result);
  const rows = demoImprovementTargets(result);
  expect(rows[0].after).toBe(120);
  expect(rows[1].after).toBe(240);
  expect(rows[3].after).toBe(40);
  expect(rows[2].after).toBeUndefined();
  expect(JSON.stringify(result)).toBe(before);
});
