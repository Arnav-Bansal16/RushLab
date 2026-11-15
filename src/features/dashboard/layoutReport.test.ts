import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ComparisonEvidence,
  Issues,
  MetricValue,
  OptimizationEvidence,
  ImprovementSummary,
} from "./LayoutReport";
import {
  optimizeLayout,
  buildIssuesReport,
} from "../../analytics/recommendations";
import { compareScenarios } from "../../analytics/comparison";
import { runSimulation } from "../../simulation";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import { fromFestival } from "../editor/layout";
import { snapshotFestival } from "../editor/simulationInput";
import type {
  LayoutOptimization,
  ScenarioComparison,
  SimulationResult,
} from "../../domain";
const html = (comparison: ScenarioComparison) =>
  renderToStaticMarkup(
    createElement(ComparisonEvidence, { comparison, festival: demoFestival }),
  );
const report = (output: LayoutOptimization) =>
  renderToStaticMarkup(createElement(OptimizationEvidence, { output }));
function real() {
  const festival = structuredClone(demoFestival);
  festival.stages = [];
  festival.vendors = [festival.vendors[0]];
  festival.vendors[0].servers = 1;
  festival.vendors[0].serviceTimeSeconds = 40;
  return runSimulation(festival, {
    ...demoSimulationResult.settings,
    seed: 71,
    attendeeCount: 50,
    durationSeconds: 240,
    frameIntervalSeconds: 240,
    behavior: {
      intentWeights: {
        vendor_first: 1,
        stage_first: 0,
        explorer: 0,
        amenity_first: 0,
      },
    },
  });
}
describe("UI-03B canonical evidence", () => {
  it("preserves signed and zero supplied values and semantic absence reasons", () => {
    for (const value of [-12, 0, 3])
      expect(
        renderToStaticMarkup(
          createElement(MetricValue, {
            value: { status: "available", value },
            delta: true,
          }),
        ),
      ).toContain(value > 0 ? `+${value}` : `${value}`);
    for (const reason of ["zero_baseline", "no_stockout"] as const)
      expect(
        renderToStaticMarkup(
          createElement(MetricValue, {
            value: { status: "not_applicable", reason },
          }),
        ),
      ).toContain(`Not applicable (${reason.replaceAll("_", " ")})`);
    expect(
      renderToStaticMarkup(
        createElement(MetricValue, {
          value: { status: "unavailable", reason: "metric_not_recorded" },
        }),
      ),
    ).toContain("Unavailable (metric not recorded)");
  });
  it("renders incompatible structured errors without fair comparison deltas", () => {
    const other = structuredClone(demoSimulationResult);
    other.settings.seed++;
    const comparison = compareScenarios(demoSimulationResult, other);
    expect(comparison.compatibility.status).toBe("incompatible");
    const markup = html(comparison);
    expect(markup).toContain("settings_mismatch");
    expect(markup).not.toContain("Absolute delta");
    expect(markup).not.toContain("objective delta");
  });
  it("retains optional absence, one-sided entities, sparse transitions and warnings", () => {
    const base: SimulationResult = structuredClone(demoSimulationResult);
    const alternative = structuredClone(base);
    delete base.vendorMetrics[0].missedSales;
    alternative.destinationTransitions = [
      { fromType: "vendor", toType: "stage", count: 7 },
    ];
    base.destinationTransitions = [];
    const comparison = compareScenarios(base, alternative);
    const markup = html(comparison);
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Not applicable");
    expect(markup).toContain("alternative only");
    expect(markup).toContain("entity_only_on_one_side");
    expect(markup).toContain("<td>0</td>");
    expect(markup).toContain("+7");
    expect(markup).toContain("Selected seed:");
  });
  it("exposes one-sided physical entities without replacing absent values with zeros", () => {
    const base: SimulationResult = structuredClone(demoSimulationResult);
    const alternative = structuredClone(base);
    alternative.vendorMetrics = [];
    alternative.destinationMetrics = [];
    const comparison = compareScenarios(base, alternative);
    expect(comparison.compatibility.status).toBe("compatible");
    const markup = html(comparison);
    expect(markup).toContain("baseline only");
    expect(markup).toContain("Unavailable (entity absent)");
    expect(markup).toContain("entity_only_on_one_side");
  });
  it("distinguishes no supported findings from unavailable evidence", () => {
    const issues = buildIssuesReport(real());
    issues.findings = [];
    issues.unavailableEvidence = [
      {
        metric: "missedSaleValue",
        entityIds: [],
        reason: "Not recorded in source run",
      },
    ];
    const markup = renderToStaticMarkup(
      createElement(Issues, { report: issues }),
    );
    expect(markup).toContain("No supported findings");
    expect(markup).toContain("Unavailable evidence");
    expect(markup).toContain("Not recorded in source run");
  });
  it("renders ordered findings with evidence, thresholds, activity, action and limitations", () => {
    const result = real();
    const issues = buildIssuesReport(result);
    expect(issues.findings.length).toBeGreaterThan(0);
    const markup = renderToStaticMarkup(
      createElement(Issues, { report: issues }),
    );
    for (const finding of issues.findings) {
      expect(markup).toContain(
        finding.suggestedAction.replaceAll("&", "&amp;"),
      );
      expect(markup).toContain(finding.limitation);
    }
    expect(markup).toContain("Activity observed / required");
    expect(markup).toContain("Threshold rule");
  });
  it("real frame-free simulation → optimization → retained comparison → editable independent layout", () => {
    const result = real();
    result.frames = [];
    const before = JSON.stringify(result);
    const start = performance.now();
    const output = optimizeLayout(result);
    console.info(
      `UI-03B local evaluation: ${(performance.now() - start).toFixed(1)} ms`,
    );
    expect(output.ranking.bestTestedId).not.toBeNull();
    const markup = report(output);
    expect(markup).toContain("Best-tested");
    expect(markup).toContain("Objective components");
    expect(markup).toContain("Absolute delta");
    const candidate = output.generation.candidates.find(
      (candidate) => candidate.id === output.ranking.bestTestedId,
    )!;
    const draft = fromFestival(structuredClone(candidate.festival));
    expect(snapshotFestival(draft)).toEqual(candidate.festival);
    draft.vendors[0].name = "Independent edit";
    expect(candidate.festival.vendors[0].name).not.toBe("Independent edit");
    expect(JSON.stringify(result)).toBe(before);
    const pair = output.ranking.evaluations[0].seeds[0];
    expect(pair.comparison).toEqual(
      compareScenarios(pair.baseline!, pair.alternative!),
    );
  });
  it("keeps empty, rejected, tied, failed and non-improving states explicit", () => {
    const output = optimizeLayout(real());
    output.ranking.tieGroups = [["candidate-a", "candidate-b"]];
    output.ranking.outcome = "no_improvement";
    output.ranking.improvingId = null;
    output.generation.rejectedActions.push({
      actionId: "rejected",
      reason: "obstacle_overlap",
      detail: "Blocked by obstacle",
    });
    const failed = output.ranking.evaluations[0].seeds[0];
    output.ranking.evaluations[0].seeds[0] = {
      ...failed,
      status: "failed",
      stage: "objective",
      reasons: ["Missing objective evidence"],
      objectiveDelta: null,
    };
    let markup = report(output);
    expect(markup).toContain("no improvement");
    expect(markup).toContain("Tied candidates: candidate-a, candidate-b");
    expect(markup).toContain("obstacle_overlap");
    expect(markup).toContain("Evaluation failed at objective");
    expect(markup).toContain("Absolute delta");
    for (const outcome of ["no_findings", "no_legal_candidates"] as const) {
      output.generation.outcome = outcome;
      expect(report(output)).toContain(outcome.replaceAll("_", " "));
    }
    output.ranking.outcome = "no_successful_evaluation";
    markup = report(output);
    expect(markup).toContain("no successful evaluation");
  });
  it("does not evaluate during initial report rendering", async () => {
    const analytics = await import("../../analytics/recommendations");
    const spy = vi.spyOn(analytics, "optimizeLayout");
    const LayoutReport = (await import("./LayoutReport")).default;
    const result = real();
    const run = {
      result,
      festivalSnapshot: result.festival,
      settingsSnapshot: result.settings,
      warnings: [],
    };
    const markup = renderToStaticMarkup(createElement(LayoutReport, { run }));
    expect(markup).toContain("Before and after");
    expect(markup).not.toContain("Show before");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

it("leads with grouped issue summaries and a tested before-and-after report", () => {
  const result = real();
  const output = optimizeLayout(result);
  const issues = renderToStaticMarkup(
    createElement(Issues, { report: output.issues }),
  );
  expect(issues).toContain("Layout issues summary");
  expect(issues).toContain("Issues, locations and solutions");
  expect(issues).toContain("Detailed issue evidence and model limitations");
  const summary = renderToStaticMarkup(
    createElement(ImprovementSummary, { output }),
  );
  expect(summary).toContain("Before and after");
  expect(summary).toContain("Before and after results");
  expect(summary).toContain("Modeled sales lost (currency units)");
  expect(summary).not.toContain("Percentage delta");
  expect(summary.match(/<tr>/g)).toHaveLength(5);
  expect(summary).toContain("Average completed queue wait change");
  expect(summary).not.toContain("<select");
  output.ranking.improvingId = null;
  expect(
    renderToStaticMarkup(createElement(ImprovementSummary, { output })),
  ).toContain("No overall improvement found");
});
