import type { LayoutOptimization, SimulationResult } from "../../domain";
import { buildIssuesReport } from "./issues";
import { generateCandidates } from "./generate";
import { deriveEvaluationSeeds, evaluateCandidates } from "./evaluate";

/** Completed ActiveRun result in; serializable editable snapshots and evidence out. */
export function optimizeLayout(result: SimulationResult): LayoutOptimization {
  const issues = buildIssuesReport(result);
  const generation = generateCandidates(result.festival, issues);
  return {
    issues,
    generation,
    seeds: deriveEvaluationSeeds(result.settings.seed),
    ranking: evaluateCandidates(
      result.festival,
      result.settings,
      generation.candidates,
    ),
  };
}
