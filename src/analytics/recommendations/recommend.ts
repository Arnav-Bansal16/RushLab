import type { RecommendPlacements, RecommendationEvidence } from "../../domain";
import { equalSnapshot } from "./equality";
import { buildIssuesReport } from "./issues";
import { generateCandidates } from "./generate";
/** Legacy boundary returns only actions that produce a legal candidate. */
export const recommendPlacements: RecommendPlacements = (festival, result) => {
  if (!equalSnapshot(festival, result.festival))
    throw new Error("Festival must match completed result snapshot");
  const report = buildIssuesReport(result);
  return generateCandidates(festival, report).candidates.map((c) => {
    const finding = report.findings.find((f) =>
      c.sourceFindingIds.includes(f.id),
    )!;
    const change = c.changes[0];
    const evidence: RecommendationEvidence[] = finding.evidence.map((e) => ({
      metric: e.metric as RecommendationEvidence["metric"],
      value: e.value,
      threshold: e.threshold,
    }));
    return {
      id: c.id,
      vendorId: change.vendorId,
      kind:
        change.kind === "move"
          ? "move"
          : change.after > change.before
            ? "increase_capacity"
            : "reduce_capacity",
      ...(change.kind === "move" ? { proposedPosition: change.after } : {}),
      rationale: c.rationale,
      evidence,
      expectedImpact: finding.severity,
    };
  });
};
