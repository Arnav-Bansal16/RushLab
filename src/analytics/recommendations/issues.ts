import type {
  CandidateAction,
  IssueCategory,
  IssueEvidence,
  IssueFinding,
  IssueReport,
  SimulationResult,
} from "../../domain";

import { destinationEvidenceErrors } from "./objective";

export const MODEL_LIMITATIONS = [
  "Results are modeled estimates, not forecasts. Behavior and thresholds are uncalibrated demo assumptions.",
  "Missed sales count modeled opportunity attempts, not unique people or actual lost revenue. Frustration is a modeled state.",
  "Destination dwell is not queue wait. Collision dynamics, walkway capacity and crowd safety are not modeled.",
  "The three-seed aggregate is not a confidence interval; best-tested does not mean globally optimal.",
];
export const compareIds = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0;

/** Interpret only completed canonical results and their immutable festival snapshot. */
export function buildIssuesReport(result: SimulationResult): IssueReport {
  const report: IssueReport = {
    version: 1,
    festivalId: result.festivalId,
    festival: structuredClone(result.festival),
    findings: [],
    unavailableEvidence: [],
    limitations: [...MODEL_LIMITATIONS],
  };
  const missing = (metric: string, entityIds: string[], reason: string) =>
    report.unavailableEvidence.push({ metric, entityIds, reason });
  const add = (
    category: IssueCategory,
    entityIds: string[],
    evidence: IssueEvidence,
    severity: IssueFinding["severity"],
    suggestedAction: string,
    actionable = false,
  ) => {
    const ids = [...entityIds].sort(compareIds);
    const id = JSON.stringify([category, ids, evidence.metric]);
    const vendor =
      ids.length === 1
        ? result.festival.vendors.find((v) => v.id === ids[0])
        : undefined;
    const actions: CandidateAction[] = [];
    if (actionable && vendor) {
      actions.push({
        id: `${id}:servers`,
        vendorId: vendor.id,
        sourceFindingIds: [id],
        kind: "set_servers",
        servers: vendor.servers + 1,
      });
      [
        [10, 0],
        [0, 10],
        [-10, 0],
        [0, -10],
      ].forEach(([dx, dy], index) =>
        actions.push({
          id: `${id}:move:${index}`,
          vendorId: vendor.id,
          sourceFindingIds: [id],
          kind: "move",
          position: { x: vendor.position.x + dx, y: vendor.position.y + dy },
        }),
      );
    }
    report.findings.push({
      id,
      category,
      severity,
      affectedEntityIds: ids,
      evidence: [evidence],
      rationale: `${evidence.metric} is ${evidence.value} ${evidence.unit}; rule ${evidence.comparison} ${evidence.threshold} with activity ${evidence.observedActivity} (minimum ${evidence.minimumActivity}).`,
      suggestedAction,
      actions,
      limitation:
        MODEL_LIMITATIONS[
          category === "missed_sales" || category === "frustration"
            ? 1
            : category === "uneven_dwell" || category === "weak_transition"
              ? 2
              : 0
        ],
    });
  };
  const check = (
    category: IssueCategory,
    ids: string[],
    source: IssueEvidence["source"],
    metric: string,
    value: number,
    unit: IssueEvidence["unit"],
    threshold: number,
    activity: number,
    minimum: number,
    high: number | null,
    lower = false,
    actionable = false,
  ) => {
    if (!Number.isFinite(value) || !Number.isFinite(activity)) {
      missing(metric, ids, "Non-finite canonical evidence");
      return;
    }
    if (
      activity < minimum ||
      !(lower ? value <= threshold : value >= threshold)
    )
      return;
    add(
      category,
      ids,
      {
        source,
        metric,
        entityIds: ids,
        value,
        unit,
        threshold,
        comparison: lower ? "lte" : "gte",
        minimumActivity: minimum,
        observedActivity: activity,
      },
      lower ? "low" : high !== null && value >= high ? "high" : "medium",
      actionable
        ? "Test one extra server or a legal vendor placement; inspect paired results."
        : "Review modeled demand, inventory or attraction assumptions; monitor paired results.",
      actionable,
    );
  };
  const totalJoins = result.vendorMetrics.reduce(
    (sum, v) => sum + v.queueJoins,
    0,
  );
  const extSupported =
    result.modelSemantics?.missedSalePolicy ===
      "queue_departure_opportunity_v1" &&
    result.modelSemantics?.frustrationPolicy === "queue_departure_marker_v1";
  for (const vendor of [...result.festival.vendors].sort((a, b) =>
    compareIds(a.id, b.id),
  )) {
    const v = result.vendorMetrics.find((v) => v.vendorId === vendor.id);
    if (!v) {
      missing("vendorMetrics", [vendor.id], "Vendor canonical summary absent");
      continue;
    }
    const ids = [v.vendorId];
    check(
      "wait",
      ids,
      "vendorMetrics",
      "averageWaitSeconds",
      v.averageWaitSeconds,
      "seconds",
      60,
      v.queueJoins,
      10,
      120,
      false,
      true,
    );
    check(
      "queue",
      ids,
      "vendorMetrics",
      "maximumQueueLength",
      v.maximumQueueLength,
      "count",
      10,
      v.queueJoins,
      10,
      20,
      false,
      true,
    );
    if (v.queueJoins > 0)
      check(
        "abandonment",
        ids,
        "vendorMetrics",
        "abandonmentsPerJoin",
        v.abandonments / v.queueJoins,
        "ratio",
        0.2,
        v.queueJoins,
        10,
        0.4,
        false,
        true,
      );
    check(
      "utilization",
      ids,
      "vendorMetrics",
      "utilization",
      v.utilization,
      "ratio",
      0.9,
      v.queueJoins,
      10,
      0.98,
      false,
      true,
    );
    check(
      "underuse",
      ids,
      "vendorMetrics",
      "utilization",
      v.utilization,
      "ratio",
      0.1,
      totalJoins,
      20,
      null,
      true,
    );
    if (vendor.inventory !== null && v.stockoutTimeSeconds !== null)
      check(
        "stockout",
        ids,
        "vendorMetrics",
        "stockoutTimeSeconds",
        v.stockoutTimeSeconds,
        "seconds",
        result.settings.durationSeconds,
        v.purchases,
        1,
        null,
        true,
      );
    if (v.missedSales)
      check(
        "missed_sales",
        ids,
        "vendorMetrics",
        "missedSaleAttempts",
        v.missedSales.count,
        "count",
        5,
        v.missedSales.count,
        5,
        10,
        false,
        true,
      );
    else
      missing(
        "missedSaleAttempts",
        ids,
        "Optional canonical missed-sales summary not recorded",
      );
    if (extSupported) {
      const attempts = result.events.filter(
        (e) => e.type === "missed_sale" && e.vendorId === vendor.id,
      ).length;
      check(
        "frustration",
        ids,
        "events",
        "queueFrustrationAttempts",
        attempts,
        "count",
        5,
        attempts,
        5,
        10,
        false,
        true,
      );
    } else
      missing(
        "queueFrustrationAttempts",
        ids,
        "Unsupported or missing EXT-01 semantics",
      );
  }
  const destinationErrors = destinationEvidenceErrors(result);
  const transitionErrors =
    result.destinationTransitions.some(
      (t) => !Number.isFinite(t.count) || t.count < 0,
    ) ||
    new Set(
      result.destinationTransitions.map((t) => `${t.fromType}->${t.toType}`),
    ).size !== result.destinationTransitions.length;
  if (destinationErrors.length)
    missing("destinationMetrics", [], destinationErrors.join("; "));
  if (transitionErrors)
    missing(
      "destinationTransitions",
      [],
      "Invalid or duplicate transition evidence",
    );
  if (!destinationErrors.length) {
    for (const type of [
      "vendor",
      "stage",
      "restroom",
      "seating",
      "first_aid",
    ] as const) {
      const rows = result.destinationMetrics.filter(
        (d) => d.destinationType === type,
      );
      const visits = rows.reduce((s, d) => s + d.visits, 0);
      const dwell = rows.reduce(
        (s, d) => s + d.completedDwellSeconds + d.truncatedDwellSeconds,
        0,
      );
      if (rows.length < 2 || visits < 20) continue;
      for (const d of rows) {
        check(
          "uneven_visits",
          [d.destinationId],
          "destinationMetrics",
          "typeVisitShare",
          d.visits / visits,
          "ratio",
          0.75,
          visits,
          20,
          0.9,
        );
        check(
          "underuse",
          [d.destinationId],
          "destinationMetrics",
          "typeVisitShare",
          d.visits / visits,
          "ratio",
          0.05,
          visits,
          20,
          null,
          true,
        );
        if (dwell > 0)
          check(
            "uneven_dwell",
            [d.destinationId],
            "destinationMetrics",
            "typeDwellShare",
            (d.completedDwellSeconds + d.truncatedDwellSeconds) / dwell,
            "ratio",
            0.75,
            visits,
            20,
            0.9,
          );
      }
    }
    const types = [
      ...new Set(result.destinationMetrics.map((d) => d.destinationType)),
    ].sort(compareIds);
    for (const from of transitionErrors ? [] : types) {
      const outgoing = result.destinationTransitions
        .filter((t) => t.fromType === from)
        .reduce((s, t) => s + t.count, 0);
      if (outgoing < 20) continue;
      for (const to of types) {
        if (
          from === to ||
          result.settings.behavior.destinationTypeWeights[to] <= 0
        )
          continue;
        const count =
          result.destinationTransitions.find(
            (t) => t.fromType === from && t.toType === to,
          )?.count ?? 0;
        check(
          "weak_transition",
          result.destinationMetrics
            .filter(
              (d) => d.destinationType === from || d.destinationType === to,
            )
            .map((d) => d.destinationId)
            .sort(compareIds),
          "destinationTransitions",
          `${from}->${to}:outgoingShare`,
          count / outgoing,
          "ratio",
          0.05,
          outgoing,
          20,
          null,
          true,
        );
      }
    }
  }
  const severity = { high: 0, medium: 1, low: 2 };
  report.findings.sort(
    (a, b) =>
      severity[a.severity] - severity[b.severity] ||
      compareIds(a.category, b.category) ||
      compareIds(a.id, b.id),
  );
  report.unavailableEvidence.sort((a, b) =>
    compareIds(JSON.stringify(a), JSON.stringify(b)),
  );
  return report;
}
