import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CandidateAction,
  CandidateEvaluation,
  Festival,
  IssueReport,
  LayoutCandidate,
  SimulationResult,
} from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import * as engine from "../../simulation";
import { compareScenarios } from "../comparison";
import {
  buildIssuesReport,
  deriveEvaluationSeeds,
  evaluateCandidates,
  generateCandidates,
  rankCandidates,
  optimizeLayout,
  recommendPlacements,
  validateCandidateGeometry,
} from ".";
import { objectiveValues, scorePair, OBJECTIVE } from "./objective";
afterEach(() => vi.restoreAllMocks());
const clone = <T>(v: T): T => structuredClone(v);
const settings = {
  seed: 71,
  attendeeCount: 50,
  durationSeconds: 240,
  stepSeconds: 0.5,
  frameIntervalSeconds: 240,
  walkingSpeedMetersPerSecond: 1.4,
  behavior: {
    intentWeights: {
      stage_first: 0,
      vendor_first: 1,
      explorer: 0,
      amenity_first: 0,
    },
  },
};
function loaded(): SimulationResult {
  const r: SimulationResult = clone(demoSimulationResult);
  r.vendorMetrics[0] = {
    ...r.vendorMetrics[0],
    queueJoins: 20,
    averageWaitSeconds: 120,
    maximumQueueLength: 20,
    abandonments: 8,
    utilization: 0.98,
    missedSales: { count: 10, value: 120 },
  };
  return r;
}
function actionReport(actions: CandidateAction[]): IssueReport {
  const r = buildIssuesReport(loaded());
  r.findings = [{ ...r.findings[0], actions }];
  return r;
}
function action(kind: "move" | "set_servers", n: number): CandidateAction {
  const base = {
    id: `action-${kind}-${n}`,
    vendorId: demoFestival.vendors[0].id,
    sourceFindingIds: ["source"],
  };
  return kind === "move"
    ? { ...base, kind, position: { x: n, y: 10 } }
    : { ...base, kind, servers: n };
}
function candidate(festival: Festival = demoFestival): LayoutCandidate {
  return generateCandidates(
    festival,
    actionReport([action("set_servers", festival.vendors[0].servers + 1)]),
  ).candidates[0];
}

describe("ANA-02 issues", () => {
  it("has stable IDs/order, inclusive thresholds, units and severity", () => {
    const result = loaded(),
      before = clone(result);
    const report = buildIssuesReport(result);
    expect(report).toEqual(buildIssuesReport(result));
    expect(result).toEqual(before);
    expect(report.findings.slice(0, 4).map((f) => f.category)).toEqual([
      "abandonment",
      "missed_sales",
      "queue",
      "utilization",
    ]);
    expect(report.findings.find((f) => f.category === "wait")).toMatchObject({
      severity: "high",
      evidence: [
        {
          value: 120,
          threshold: 60,
          comparison: "gte",
          unit: "seconds",
          minimumActivity: 10,
          observedActivity: 20,
        },
      ],
    });
    result.vendorMetrics[0].averageWaitSeconds = 60;
    expect(
      buildIssuesReport(result).findings.find((f) => f.category === "wait"),
    ).toMatchObject({
      severity: "medium",
      id: report.findings.find((f) => f.category === "wait")!.id,
    });
    result.vendorMetrics[0].averageWaitSeconds = 59.99;
    expect(
      buildIssuesReport(result).findings.some((f) => f.category === "wait"),
    ).toBe(false);
  });
  it("requires activity and preserves zero, missing, null and unlimited distinctions", () => {
    const r: SimulationResult = clone(demoSimulationResult);
    r.events = [];
    r.vendorMetrics[0].averageWaitSeconds = 200;
    r.vendorMetrics[0].queueJoins = 0;
    expect(buildIssuesReport(r).findings).toEqual([]);
    expect(
      buildIssuesReport(r).unavailableEvidence.some(
        (e) => e.metric === "missedSaleAttempts",
      ),
    ).toBe(true);
    r.vendorMetrics[0].stockoutTimeSeconds = 0;
    r.vendorMetrics[0].purchases = 1;
    expect(
      buildIssuesReport(r).findings.some((f) => f.category === "stockout"),
    ).toBe(true);
    r.festival.vendors[0].inventory = null;
    expect(
      buildIssuesReport(r).findings.some((f) => f.category === "stockout"),
    ).toBe(false);
    r.vendorMetrics[0].stockoutTimeSeconds = null;
    r.vendorMetrics[0].missedSales = { count: 0, value: 0 };
    expect(
      buildIssuesReport(r).unavailableEvidence.some(
        (e) => e.metric === "missedSaleAttempts",
      ),
    ).toBe(false);
    r.vendorMetrics = [];
    expect(
      buildIssuesReport(r).unavailableEvidence.some(
        (e) => e.metric === "vendorMetrics",
      ),
    ).toBe(true);
  });
  it("uses event frustration attempts and explicitly handles unsupported semantics", () => {
    const r = loaded();
    r.events = Array.from({ length: 5 }, (_, i) => ({
      type: "missed_sale",
      attendeeId: "same-person",
      vendorId: r.vendorMetrics[0].vendorId,
      timeSeconds: i,
      reason: "queue_full",
      missedSaleValue: 12,
    }));
    const f = buildIssuesReport(r).findings.find(
      (f) => f.category === "frustration",
    )!;
    expect(f.evidence[0]).toMatchObject({
      value: 5,
      source: "events",
      unit: "count",
    });
    expect(f.limitation).toContain("not unique people");
    Reflect.deleteProperty(r, "modelSemantics");
    expect(
      buildIssuesReport(r).findings.some((f) => f.category === "frustration"),
    ).toBe(false);
  });
  it("reports same-type visit/dwell imbalance and sparse weak transitions only above minimums", () => {
    const r: SimulationResult = clone(demoSimulationResult);
    r.destinationMetrics = [
      {
        destinationId: "stage-a",
        destinationType: "stage",
        visits: 19,
        uniqueVisitors: 19,
        repeatVisits: 0,
        completedDwellSeconds: 100,
        truncatedDwellSeconds: 0,
      },
      {
        destinationId: "stage-b",
        destinationType: "stage",
        visits: 1,
        uniqueVisitors: 1,
        repeatVisits: 0,
        completedDwellSeconds: 0,
        truncatedDwellSeconds: 0,
      },
      {
        destinationId: "v",
        destinationType: "vendor",
        visits: 20,
        uniqueVisitors: 20,
        repeatVisits: 0,
        completedDwellSeconds: 1,
        truncatedDwellSeconds: 0,
      },
    ];
    r.festival.vendors[0].id = "v";
    r.festival.stages = ["stage-a", "stage-b"].map((id) => ({
      ...clone(r.festival.stages[0]),
      id,
    }));
    r.destinationTransitions = [
      { fromType: "stage", toType: "stage", count: 20 },
    ];
    const findings = buildIssuesReport(r).findings;
    expect(findings.some((f) => f.category === "uneven_dwell")).toBe(true);
    expect(findings.some((f) => f.category === "uneven_visits")).toBe(true);
    expect(
      findings.find((f) => f.category === "weak_transition")?.evidence[0],
    ).toMatchObject({ value: 0, threshold: 0.05, observedActivity: 20 });
    r.destinationTransitions[0].count = 19;
    expect(
      buildIssuesReport(r).findings.some(
        (f) => f.category === "weak_transition",
      ),
    ).toBe(false);
    r.destinationMetrics[0].visits = 18;
    expect(
      buildIssuesReport(r).findings.some((f) => f.category === "uneven_visits"),
    ).toBe(false);
  });
});

describe("ANA-02 bounded generation", () => {
  it("caps, deduplicates, preserves non-target fields and creates independent immutable snapshots", () => {
    const f = clone(demoFestival),
      original = clone(f);
    const report = actionReport([
      action("set_servers", 3),
      action("set_servers", 3),
      ...Array.from({ length: 6 }, (_, i) => action("move", 10 + i * 10)),
    ]);
    const generated = generateCandidates(f, report);
    expect(generated.candidates).toHaveLength(4);
    expect(
      generated.rejectedActions.some((r) => r.reason === "duplicate"),
    ).toBe(true);
    expect(generateCandidates(f, report)).toEqual(generated);
    expect(f).toEqual(original);
    for (const c of generated.candidates) {
      expect(validateCandidateGeometry(c.festival)).toBeNull();
      const restored = clone(c.festival);
      restored.vendors[0] = clone(f.vendors[0]);
      expect(restored).toEqual(f);
    }
    generated.candidates[0].festival.vendors[0].averagePrice = 999;
    expect(generated.candidates[1].festival.vendors[0].averagePrice).toBe(
      f.vendors[0].averagePrice,
    );
    expect(f).toEqual(original);
  });
  it("rejects invalid capacity, unknown vendors, unchanged moves, out of bounds and bounds attempts", () => {
    const bad = action("move", -10);
    const r = generateCandidates(
      demoFestival,
      actionReport([
        action("set_servers", 0),
        { ...bad, vendorId: "absent" },
        ...Array.from({ length: 50 }, () => bad),
      ]),
    );
    expect(r.attempts).toBe(32);
    expect(r.candidates).toEqual([]);
    expect(r.outcome).toBe("no_legal_candidates");
    expect(r.rejectedActions.map((r) => r.reason)).toContain("attempt_limit");
    expect(r.rejectedActions.map((r) => r.reason)).toContain(
      "invalid_capacity",
    );
    expect(r.rejectedActions.map((r) => r.reason)).toContain("unknown_vendor");
    expect(
      generateCandidates(demoFestival, { ...actionReport([]), findings: [] })
        .outcome,
    ).toBe("no_findings");
    const same = {
      ...action("move", 42),
      position: clone(demoFestival.vendors[0].position),
    };
    expect(
      generateCandidates(demoFestival, actionReport([same])).rejectedActions[0]
        .reason,
    ).toBe("unchanged");
  });
  it("rejects obstacle interiors, edge crossings, containing polygons and entity overlaps", () => {
    const f: Festival = clone(demoFestival);
    f.obstacles = [
      {
        id: "obstacle",
        points: [
          { x: 44, y: 29 },
          { x: 45, y: 29 },
          { x: 45, y: 30 },
          { x: 44, y: 30 },
        ],
      },
    ];
    expect(validateCandidateGeometry(f)).toBe("obstacle_overlap");
    f.obstacles[0].points = [
      { x: 40, y: 30 },
      { x: 50, y: 30 },
      { x: 50, y: 31 },
      { x: 40, y: 31 },
    ];
    expect(validateCandidateGeometry(f)).toBe("obstacle_overlap");
    f.obstacles[0].points = [
      { x: 40, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 40 },
      { x: 40, y: 40 },
    ];
    expect(validateCandidateGeometry(f)).toBe("obstacle_overlap");
    f.obstacles = [];
    f.vendors[0].position = clone(f.stages[0].position);
    expect(validateCandidateGeometry(f)).toBe("entity_overlap");
  });
  it("legacy recommendations only return legal bounded evidence-backed actions", () => {
    const r = loaded();
    const legacy = recommendPlacements(r.festival, r);
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy.length).toBeLessThanOrEqual(4);
    expect(legacy.every((r) => r.evidence.length > 0)).toBe(true);
  });
});

describe("ANA-02 paired evaluation", () => {
  it("derives a deterministic three-seed suite including signed wrap", () => {
    expect(deriveEvaluationSeeds(71)).toEqual([71, 72, 73]);
    expect(deriveEvaluationSeeds(2147483647)).toEqual([
      2147483647, -2147483648, -2147483647,
    ]);
    expect(() => deriveEvaluationSeeds(NaN)).toThrow();
  });
  it("runs real issues → candidates → INT-01 pairs, reuses baselines and is byte deterministic without frames", () => {
    const f: Festival = clone(demoFestival);
    f.stages = [];
    f.vendors[0].servers = 1;
    f.vendors[0].serviceTimeSeconds = 40;
    const real = engine.runSimulation;
    const spy = vi.spyOn(engine, "runSimulation").mockImplementation((f, s) => {
      const r = real(f, s);
      r.frames = [];
      return r;
    });
    const initial = engine.runSimulation(f, settings);
    initial.frames = [];
    const issues = buildIssuesReport(initial),
      generation = generateCandidates(f, issues);
    expect(generation.candidates.length).toBeGreaterThan(0);
    spy.mockClear();
    const before = clone({ f, settings, generation });
    const start = performance.now();
    const first = evaluateCandidates(f, settings, generation.candidates);
    const elapsed = performance.now() - start;
    expect(spy).toHaveBeenCalledTimes(3 + 3 * generation.candidates.length);
    const second = evaluateCandidates(f, settings, generation.candidates);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(
      first.evaluations.every((e) =>
        e.seeds.every(
          (p) =>
            p.baseline?.frames.length === 0 &&
            p.alternative?.frames.length === 0,
        ),
      ),
    ).toBe(true);
    expect({ f, settings, generation }).toEqual(before);
    expect(first.outcome).toBe("improved");
    for (const e of first.evaluations)
      for (const pair of e.seeds) {
        expect(pair.status).toBe("succeeded");
        if (pair.status !== "succeeded") continue;
        expect(pair.alternative.attendeeProfiles).toEqual(
          pair.baseline.attendeeProfiles,
        );
        expect(pair.alternative.settings).toEqual(pair.baseline.settings);
        expect(pair.comparison).toEqual(
          compareScenarios(pair.baseline, pair.alternative),
        );
        pair.baseline.frames = [];
        pair.alternative.frames = [];
        expect(compareScenarios(pair.baseline, pair.alternative)).toEqual(
          pair.comparison,
        );
      }
    console.info(
      "ANA-02 benchmark",
      JSON.stringify({
        attendees: settings.attendeeCount,
        candidates: generation.candidates.length,
        seeds: 3,
        elapsedMs: Math.round(elapsed),
        outcome: first.outcome,
        best: first.bestTestedId,
        raw: first.evaluations
          .find((e) => e.candidateId === first.bestTestedId)
          ?.seeds.map((p) =>
            p.status === "succeeded"
              ? {
                  seed: p.seed,
                  baseline: {
                    ...p.baseline.totals,
                    wait: p.baseline.vendorMetrics[0].averageWaitSeconds,
                    peak: p.baseline.vendorMetrics[0].maximumQueueLength,
                    missed: p.baseline.vendorMetrics[0].missedSales,
                  },
                  alternative: {
                    ...p.alternative.totals,
                    wait: p.alternative.vendorMetrics[0].averageWaitSeconds,
                    peak: p.alternative.vendorMetrics[0].maximumQueueLength,
                    missed: p.alternative.vendorMetrics[0].missedSales,
                  },
                }
              : null,
          ),
        scores: first.evaluations.map((e) => [
          e.candidateId,
          e.aggregateObjectiveDelta,
        ]),
      }),
    );
    spy.mockRestore();
  });
  it("retains incompatible model semantics and never scores rejected pairs", () => {
    const real = engine.runSimulation;
    const c = candidate();
    vi.spyOn(engine, "runSimulation").mockImplementation((f, s) => {
      const r = real(f, s);
      if (f.vendors[0].servers === 3)
        Reflect.deleteProperty(r.modelSemantics, "queueDeparturePolicy");
      return r;
    });
    const result = evaluateCandidates(demoFestival, settings, [c]);
    expect(result.outcome).toBe("no_successful_evaluation");
    expect(result.evaluations[0].aggregateObjectiveDelta).toBeNull();
    const p = result.evaluations[0].seeds[0];
    expect(p.status).toBe("failed");
    if (p.status === "failed")
      expect(
        p.comparison?.compatibility.errors.some(
          (e) => e.code === "model_semantics_mismatch",
        ),
      ).toBe(true);
    vi.restoreAllMocks();
  });
  it("retains failed baselines and alternatives, rejects undeclared mutations", () => {
    const c = candidate();
    c.festival.vendors[0].averagePrice++;
    expect(
      evaluateCandidates(demoFestival, settings, [c]).evaluations[0].seeds[0],
    ).toMatchObject({
      status: "failed",
      stage: "alternative",
      objectiveDelta: null,
    });
    const spy = vi.spyOn(engine, "runSimulation").mockImplementation(() => {
      throw new Error("test baseline failure");
    });
    expect(
      evaluateCandidates(demoFestival, settings, [candidate()]).evaluations[0]
        .seeds[0],
    ).toMatchObject({
      status: "failed",
      stage: "baseline",
      reasons: ["test baseline failure"],
    });
    spy.mockRestore();
  });
  it("handles zero demand, no candidates, missing metrics, ties and non-improving outcomes", () => {
    expect(evaluateCandidates(demoFestival, settings, []).outcome).toBe(
      "no_candidates",
    );
    const zero = evaluateCandidates(
      demoFestival,
      { ...settings, attendeeCount: 0 },
      [candidate()],
    );
    expect(zero.outcome).toBe("no_improvement");
    const pair = zero.evaluations[0].seeds[0];
    if (pair.status === "succeeded") {
      expect(pair.comparison.totals![0].percentageDelta).toEqual({
        status: "not_applicable",
        reason: "zero_baseline",
      });
      expect(
        pair.components.find((c) => c.metric === "revenue_per_attendee")
          ?.available,
      ).toBe(false);
    } else throw new Error("Zero demand still has compatible comparisons");
    const evaluation = (id: string, score: number): CandidateEvaluation => ({
      ...zero.evaluations[0],
      candidateId: id,
      eligible: true,
      aggregateObjectiveDelta: score,
      failureReasons: [],
    });
    const ties = rankCandidates([evaluation("b", 0), evaluation("a", 0)]);
    expect(ties).toMatchObject({
      bestTestedId: "a",
      improvingId: null,
      tieGroups: [["a", "b"]],
      outcome: "no_improvement",
    });
    expect(rankCandidates([evaluation("negative", -1)]).outcome).toBe(
      "no_improvement",
    );
    const r: SimulationResult = clone(demoSimulationResult);
    delete r.vendorMetrics[0].missedSales;
    Reflect.deleteProperty(r, "modelSemantics");
    expect(objectiveValues(r).frustration_per_attendee).toBeNull();
    expect(objectiveValues(r).missed_sale_value_per_attendee).toBeNull();
  });
  it("transparent objective can improve while revenue worsens; missing alternative evidence fails", () => {
    const b = loaded(),
      a = clone(b);
    b.events = [
      {
        type: "service_start",
        timeSeconds: 0,
        attendeeId: "one",
        vendorId: b.vendorMetrics[0].vendorId,
      },
    ];
    a.events = clone(b.events);
    a.vendorMetrics[0].averageWaitSeconds = 0;
    a.totals.revenue = b.totals.revenue - 1;
    const enabled = new Set(
      OBJECTIVE.filter((d) => objectiveValues(b)[d.metric] !== null).map(
        (d) => d.metric,
      ),
    );
    const score = scorePair(b, a, enabled, b.festival);
    expect(score.delta).toBeGreaterThan(0);
    expect(
      score.components.find((c) => c.metric === "revenue_per_attendee"),
    ).toMatchObject({ available: true, contribution: expect.any(Number) });
    a.vendorMetrics = [];
    expect(scorePair(b, a, enabled, b.festival).delta).toBeNull();
  });
});

describe("ANA-02 additional integration states", () => {
  it("composes from a completed result with no playback and has serializable empty output", () => {
    const r = engine.runSimulation(demoFestival, {
      ...settings,
      attendeeCount: 0,
    });
    r.frames = [];
    const before = clone(r),
      output = optimizeLayout(r);
    expect(output.ranking.outcome).toBe("no_candidates");
    expect(output.generation.outcome).toBe("no_findings");
    expect(JSON.parse(JSON.stringify(output))).toEqual(output);
    expect(r).toEqual(before);
  });
  it("preserves alternative simulation failure and profile mismatch", () => {
    const real = engine.runSimulation;
    const c = candidate();
    const spy = vi.spyOn(engine, "runSimulation").mockImplementation((f, s) => {
      if (f.vendors[0].servers === 3) throw new Error("alternative failed");
      return real(f, s);
    });
    expect(
      evaluateCandidates(demoFestival, settings, [c]).evaluations[0].seeds[0],
    ).toMatchObject({
      status: "failed",
      stage: "alternative",
      alternative: null,
      reasons: ["alternative failed"],
    });
    spy.mockImplementation((f, s) => {
      const r = real(f, s);
      if (f.vendors[0].servers === 3) r.attendeeProfiles[0].initialBudget++;
      return r;
    });
    const mismatch = evaluateCandidates(demoFestival, settings, [c]);
    expect(mismatch.outcome).toBe("no_successful_evaluation");
    expect(mismatch.evaluations[0].seeds[0]).toMatchObject({
      status: "failed",
      stage: "comparison",
    });
    spy.mockRestore();
  });
  it("rejects non-finite canonical evidence and ignores frames for findings", () => {
    const r = loaded();
    r.vendorMetrics[0].averageWaitSeconds = NaN;
    const first = buildIssuesReport(r);
    r.frames = [];
    expect(buildIssuesReport(r)).toEqual(first);
    expect(first.findings.some((f) => f.category === "wait")).toBe(false);
    expect(
      first.unavailableEvidence.some((e) => e.metric === "averageWaitSeconds"),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
  it("rejects more than four evaluations and duplicate IDs before simulation", () => {
    const c = candidate();
    expect(() =>
      evaluateCandidates(demoFestival, settings, Array(5).fill(c)),
    ).toThrow("four");
    expect(() => evaluateCandidates(demoFestival, settings, [c, c])).toThrow(
      "Duplicate",
    );
  });
});

describe("ANA-02 evidence guards", () => {
  it("rejects stale editor state and keeps the report snapshot independent", () => {
    const r = loaded(),
      report = buildIssuesReport(r);
    const f = clone(r.festival);
    f.vendors[0].averagePrice++;
    expect(() => generateCandidates(f, report)).toThrow("snapshot");
    report.festival.vendors[0].name = "changed copy";
    expect(r.festival.vendors[0].name).not.toBe("changed copy");
  });
  it("does not rank a comparison missing required final summaries", () => {
    const real = engine.runSimulation;
    vi.spyOn(engine, "runSimulation").mockImplementation((f, s) => {
      const r = real(f, s);
      if (f.vendors[0].servers === 3) r.destinationMetrics = [];
      return r;
    });
    const ranking = evaluateCandidates(demoFestival, settings, [candidate()]);
    expect(ranking.outcome).toBe("no_successful_evaluation");
    expect(ranking.evaluations[0].seeds[0]).toMatchObject({
      status: "failed",
      stage: "objective",
      reasons: ["Incomplete destination summaries"],
    });
  });
});
