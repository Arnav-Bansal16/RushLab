import type {
  LayoutCandidate,
  LayoutOptimization,
  SimulationResult,
} from "../../domain";
import {
  buildIssuesReport,
  deriveEvaluationSeeds,
  evaluateCandidates,
  validateCandidateGeometry,
} from "../../analytics/recommendations";

/** Explicit higher-service-capacity what-if; all outputs still come from ANA-02/INT-01. */
export function evaluateCapacityScenario(
  result: SimulationResult,
): LayoutOptimization {
  const issues = buildIssuesReport(result);
  const festival = structuredClone(result.festival);
  const changes: LayoutCandidate["changes"] = [];
  for (const vendor of festival.vendors) {
    const after = Math.min(100, vendor.servers * 4);
    if (after === vendor.servers) continue;
    changes.push({
      kind: "set_servers",
      vendorId: vendor.id,
      before: vendor.servers,
      after,
    });
    vendor.servers = after;
  }
  const geometryError = validateCandidateGeometry(festival);
  const candidate: LayoutCandidate = {
    id: "higher-service-capacity",
    festival,
    changes,
    sourceFindingIds: issues.findings
      .filter((finding) =>
        finding.actions.some((action) => action.kind === "set_servers"),
      )
      .map((finding) => finding.id),
    sourceActionIds: [],
    rationale:
      "What-if: four times the service capacity at each vendor, capped at 100 servers per vendor. Service time, prices, inventory, patience and demand are unchanged. Additional staffing and capacity costs are not modeled.",
  };
  const candidates = changes.length && !geometryError ? [candidate] : [];
  return {
    issues,
    seeds: deriveEvaluationSeeds(result.settings.seed),
    generation: {
      candidates,
      attempts: 1,
      attemptLimit: 1,
      rejectedActions: [],
      reasons: geometryError
        ? [geometryError]
        : changes.length
          ? []
          : ["No additional vendor capacity available."],
      outcome: candidates.length ? "generated" : "no_legal_candidates",
    },
    ranking: evaluateCandidates(result.festival, result.settings, candidates),
  };
}
