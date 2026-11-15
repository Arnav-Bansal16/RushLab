import { describe, expect, it } from "vitest";
import type { Festival, LayoutCandidate, SimulationResult } from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { runSimulation } from "../../simulation";
import { assessScenarioCompatibility, compareScenarios } from "../comparison";
import {
  buildIssuesReport,
  evaluateCandidates,
  generateCandidates,
  rankCandidates,
  recommendPlacements,
} from ".";
import { validateCandidateChanges } from "./generate";

const settings = {
  seed: 71,
  attendeeCount: 50,
  durationSeconds: 240,
  stepSeconds: 0.5,
  frameIntervalSeconds: 240,
  walkingSpeedMetersPerSecond: 1.4,
};
function setup() {
  const f: Festival = structuredClone(demoFestival);
  f.stages = [];
  f.vendors[0].servers = 1;
  f.vendors[0].serviceTimeSeconds = 40;
  const result = runSimulation(f, settings);
  result.frames = [];
  const report = buildIssuesReport(result);
  return {
    f,
    result,
    report,
    candidates: generateCandidates(f, report).candidates,
  };
}
function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reorder(v)]),
    );
  return value;
}

describe("ANA-02 / merged INT-01 contract integration", () => {
  it("accepts unchanged JSON snapshots with reordered object keys, including point before values", () => {
    const { f, result, report, candidates } = setup();
    const reordered = reorder(f) as Festival;
    expect(() => generateCandidates(reordered, report)).not.toThrow();
    expect(recommendPlacements(reordered, result)).toEqual(
      recommendPlacements(f, result),
    );
    for (const candidate of candidates) {
      const edited = reorder(candidate) as LayoutCandidate;
      expect(validateCandidateChanges(f, edited)).toEqual([]);
      expect(
        assessScenarioCompatibility(
          result,
          runSimulation(edited.festival, settings),
        ).status,
      ).toBe("compatible");
    }
    const ranking = evaluateCandidates(reordered, settings, candidates);
    expect(ranking.orderedEligibleIds).toHaveLength(candidates.length);
  });
  it("does not manufacture imbalance or transition findings from missing, duplicate or invalid destination rows", () => {
    const { result } = setup();
    result.festival.stages = ["a", "b", "missing"].map((id, i) => ({
      id,
      name: id,
      position: { x: 80 + i * 10, y: 10 },
      size: { width: 4, height: 4 },
      attraction: 1,
    }));
    result.destinationMetrics.push(
      ...["a", "b"].map((destinationId) => ({
        destinationId,
        destinationType: "stage" as const,
        visits: 20,
        uniqueVisitors: 20,
        repeatVisits: 0,
        completedDwellSeconds: 100,
        truncatedDwellSeconds: 0,
      })),
    );
    result.destinationTransitions = [
      { fromType: "stage", toType: "stage", count: 20 },
    ];
    const assertUnavailable = (r: SimulationResult) => {
      const report = buildIssuesReport(r);
      expect(
        report.findings.some((f) =>
          ["uneven_visits", "uneven_dwell", "weak_transition"].includes(
            f.category,
          ),
        ),
      ).toBe(false);
      expect(
        report.unavailableEvidence.some(
          (e) => e.metric === "destinationMetrics",
        ),
      ).toBe(true);
    };
    assertUnavailable(result);
    result.destinationMetrics.push({
      ...result.destinationMetrics.at(-1)!,
      destinationId: "a",
    });
    assertUnavailable(result);
    result.destinationMetrics.at(-1)!.destinationId = "missing";
    result.destinationMetrics.at(-1)!.visits = NaN;
    assertUnavailable(result);
  });
  it("preserves INT-01 raw deltas, zero denominators, unavailable metrics, stockout states and warnings", () => {
    const { f, candidates } = setup();
    const ranking = evaluateCandidates(
      f,
      { ...settings, attendeeCount: 0 },
      candidates,
    );
    for (const e of ranking.evaluations)
      for (const p of e.seeds) {
        expect(p.status).toBe("succeeded");
        if (p.status !== "succeeded") continue;
        expect(p.comparison).toEqual(
          compareScenarios(p.baseline, p.alternative),
        );
        expect(
          p.comparison.totals!.find((m) => m.metric === "revenue")!
            .percentageDelta,
        ).toEqual({ status: "not_applicable", reason: "zero_baseline" });
        const metrics = p.comparison.vendors![0].metrics;
        expect(
          metrics.find((m) => m.metric === "missedSaleValue")!.baseline,
        ).toEqual({ status: "unavailable", reason: "metric_not_recorded" });
        expect(
          metrics.find((m) => m.metric === "stockoutTimeSeconds")!.baseline,
        ).toEqual({ status: "not_applicable", reason: "no_stockout" });
        expect(
          p.comparison.compatibility.warnings.some(
            (w) => w.code === "optional_metric_unavailable",
          ),
        ).toBe(true);
      }
  });
  it("cannot rank restored data carrying an incompatible or incomplete INT-01 comparison", () => {
    const { f, candidates } = setup();
    const original = evaluateCandidates(
      f,
      { ...settings, attendeeCount: 0 },
      candidates.slice(0, 1),
    );
    const rejected = structuredClone(original.evaluations);
    for (const p of rejected[0].seeds)
      if (p.status === "succeeded")
        p.comparison.compatibility.status = "incompatible";
    expect(rankCandidates(rejected).outcome).toBe("no_successful_evaluation");
    const incomplete = structuredClone(original.evaluations);
    for (const p of incomplete[0].seeds)
      if (p.status === "succeeded") p.comparison.destinations = null;
    expect(rankCandidates(incomplete).bestTestedId).toBeNull();
    expect(rankCandidates(original.evaluations).bestTestedId).not.toBeNull();
  });
  it("does not interpret a changed frustration policy as supported EXT-01 evidence", () => {
    const { result } = setup();
    Reflect.set(result.modelSemantics, "frustrationPolicy", "unknown");
    const report = buildIssuesReport(result);
    expect(report.findings.some((f) => f.category === "frustration")).toBe(
      false,
    );
    expect(
      report.unavailableEvidence.some(
        (e) => e.metric === "queueFrustrationAttempts",
      ),
    ).toBe(true);
  });
});
