import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluateCapacityScenario } from "./evaluateCapacityScenario";
import { executeRun } from "../playback/run";
import {
  createFestivalDemo,
  festivalDemoSettings,
} from "../playback/vendorDemo";
import { compareScenarios } from "../../analytics/comparison";
import { totalMissedSaleValue } from "../../analytics/metrics/totalMissedSaleValue";
import { ImprovementSummary, OptimizationEvidence } from "./LayoutReport";

describe("higher-capacity what-if", () => {
  it("uses real compatible modeled improvements without changing baseline or fabricating values", () => {
    const run = executeRun(createFestivalDemo(), festivalDemoSettings);
    if (!run.ok) throw new Error(run.errors.join("; "));
    const before = JSON.stringify(run.run.result);
    const output = evaluateCapacityScenario(run.run.result);
    expect(output.ranking.bestTestedId).toBe("higher-service-capacity");
    const candidate = output.generation.candidates[0];
    expect(candidate.changes).toHaveLength(8);
    expect(
      candidate.festival.vendors.every((vendor) => vendor.servers === 4),
    ).toBe(true);
    const pair = output.ranking.evaluations[0].seeds[0];
    expect(pair.status).toBe("succeeded");
    if (pair.status !== "succeeded") throw new Error(pair.reasons.join("; "));
    expect(pair.comparison).toEqual(
      compareScenarios(pair.baseline, pair.alternative),
    );
    expect(pair.alternative.attendeeProfiles).toEqual(
      pair.baseline.attendeeProfiles,
    );
    expect(pair.alternative.settings).toEqual(pair.baseline.settings);
    expect(pair.alternative.totals.purchases).toBeGreaterThan(
      pair.baseline.totals.purchases,
    );
    expect(pair.alternative.totals.revenue).toBeGreaterThan(
      pair.baseline.totals.revenue,
    );
    expect(totalMissedSaleValue(pair.alternative.vendorMetrics)!).toBeLessThan(
      totalMissedSaleValue(pair.baseline.vendorMetrics)!,
    );
    expect(pair.alternative.vendorMetrics[0].averageWaitSeconds).toBeLessThan(
      pair.baseline.vendorMetrics[0].averageWaitSeconds,
    );
    expect(JSON.stringify(run.run.result)).toBe(before);
    const markup = renderToStaticMarkup(
      createElement(ImprovementSummary, { output }),
    );
    expect(markup).toContain("4×");
    expect(markup).toContain("Less waiting");
    expect(markup).toContain("Capacity costs are not modeled");
    const report = renderToStaticMarkup(
      createElement(OptimizationEvidence, { output }),
    );
    expect(report).not.toContain("Load candidate into editor");
    expect(report).not.toContain("Candidate has not been loaded");
  });
});
