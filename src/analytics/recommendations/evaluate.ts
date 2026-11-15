import type {
  CandidateEvaluation,
  CandidateRanking,
  Festival,
  LayoutCandidate,
  ObjectiveMetric,
  ObjectiveComponent,
  SeedEvaluation,
  SimulationResult,
  SimulationSettings,
} from "../../domain";
import { runSimulation } from "../../simulation";
import { compareScenarios } from "../comparison";
import { validateCandidateChanges } from "./generate";
import { compareIds, MODEL_LIMITATIONS } from "./issues";
import {
  OBJECTIVE,
  objectiveValues,
  scorePair,
  incompleteEvidence,
} from "./objective";

export function deriveEvaluationSeeds(seed: number): [number, number, number] {
  if (!Number.isSafeInteger(seed))
    throw new Error("Seed must be a safe integer");
  const s = seed | 0;
  return [s, (s + 1) | 0, (s + 2) | 0];
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function rankCandidates(
  evaluations: CandidateEvaluation[],
): CandidateRanking {
  const eligible = evaluations
    .filter(
      (e): e is CandidateEvaluation & { eligible: true } =>
        e.eligible &&
        Number.isFinite(e.aggregateObjectiveDelta) &&
        e.seeds.length === 3 &&
        e.seeds.every(
          (p) =>
            p.status === "succeeded" &&
            Number.isFinite(p.objectiveDelta) &&
            p.comparison.compatibility.status === "compatible" &&
            p.comparison.totals !== null &&
            p.comparison.vendors !== null &&
            p.comparison.destinations !== null &&
            p.comparison.destinationTransitions !== null,
        ),
    )
    .sort(
      (a, b) =>
        b.aggregateObjectiveDelta - a.aggregateObjectiveDelta ||
        compareIds(a.candidateId, b.candidateId),
    );
  const groups: string[][] = [];
  for (let i = 0; i < eligible.length;) {
    let end = i + 1;
    while (
      end < eligible.length &&
      eligible[end].aggregateObjectiveDelta ===
        eligible[i].aggregateObjectiveDelta
    )
      end++;
    if (end - i > 1)
      groups.push(eligible.slice(i, end).map((e) => e.candidateId));
    i = end;
  }
  const best = eligible[0];
  return {
    orderedEligibleIds: eligible.map((e) => e.candidateId),
    tieGroups: groups,
    bestTestedId: best?.candidateId ?? null,
    improvingId:
      best && best.aggregateObjectiveDelta > 0 ? best.candidateId : null,
    outcome: !evaluations.length
      ? "no_candidates"
      : !best
        ? "no_successful_evaluation"
        : best.aggregateObjectiveDelta > 0
          ? "improved"
          : "no_improvement",
    evaluations,
    limitations: [...MODEL_LIMITATIONS],
  };
}

/** At most 3 baselines + 12 alternatives; no timers, frames, mutation or hidden reruns. */
export function evaluateCandidates(
  festival: Festival,
  settings: SimulationSettings,
  candidates: readonly LayoutCandidate[],
): CandidateRanking {
  if (candidates.length > 4)
    throw new Error("ANA-02 supports at most four candidates");
  if (new Set(candidates.map((c) => c.id)).size !== candidates.length)
    throw new Error("Duplicate candidate IDs");
  if (!candidates.length) return rankCandidates([]);
  const seeds = deriveEvaluationSeeds(settings.seed);
  const baselines = seeds.map((seed) => {
    try {
      return {
        result: runSimulation(
          structuredClone(festival),
          structuredClone({ ...settings, seed }),
        ),
        error: null,
      };
    } catch (error) {
      return { result: null, error: message(error) };
    }
  });
  const enabled = new Set<ObjectiveMetric>(
    OBJECTIVE.filter((d) =>
      baselines.every(
        (b) => b.result && objectiveValues(b.result)[d.metric] !== null,
      ),
    ).map((d) => d.metric),
  );
  const evaluations: CandidateEvaluation[] = candidates.map((candidate) => {
    const invalid = validateCandidateChanges(festival, candidate);
    const pairs = seeds.map((seed, index): SeedEvaluation => {
      const baseline = baselines[index].result;
      let alternative: SimulationResult | null = null;
      let components: ObjectiveComponent[] = [];
      let comparison: ReturnType<typeof compareScenarios> | null = null;
      let stage: "baseline" | "alternative" | "comparison" | "objective" =
        "baseline";
      const fail = (reasons: string[]): SeedEvaluation => ({
        status: "failed",
        seed,
        stage,
        reasons,
        baseline: baseline ? structuredClone(baseline) : null,
        alternative,
        comparison,
        objectiveDelta: null,
        components,
      });
      if (!baseline) return fail([baselines[index].error ?? "Baseline failed"]);
      stage = "alternative";
      if (invalid.length) return fail(invalid);
      try {
        alternative = runSimulation(
          structuredClone(candidate.festival),
          structuredClone({ ...settings, seed }),
        );
        stage = "comparison";
        comparison = compareScenarios(baseline, alternative);
        if (comparison.compatibility.status === "incompatible")
          return fail(
            comparison.compatibility.errors.map(
              (e) => `${e.code}: ${e.message}`,
            ),
          );
        stage = "objective";
        const incomplete = [
          ...incompleteEvidence(baseline),
          ...incompleteEvidence(alternative),
        ];
        if (incomplete.length) return fail(incomplete);
        const score = scorePair(baseline, alternative, enabled, festival);
        components = score.components;
        if (score.delta === null) return fail(score.reasons);
        return {
          status: "succeeded",
          seed,
          baseline: structuredClone(baseline),
          alternative,
          comparison,
          components: score.components,
          objectiveDelta: score.delta,
        };
      } catch (error) {
        return fail([message(error)]);
      }
    }) as [SeedEvaluation, SeedEvaluation, SeedEvaluation];
    const reasons = pairs.flatMap((p) =>
      p.status === "failed" ? p.reasons : [],
    );
    return pairs.some((p) => p.status === "failed")
      ? {
          candidateId: candidate.id,
          seeds: pairs,
          eligible: false,
          aggregateObjectiveDelta: null,
          failureReasons: reasons.length
            ? reasons
            : ["Incomplete seed evaluation"],
        }
      : {
          candidateId: candidate.id,
          seeds: pairs,
          eligible: true,
          aggregateObjectiveDelta:
            pairs.reduce((s, p) => s + (p.objectiveDelta ?? 0), 0) / 3,
          failureReasons: [],
        };
  });
  return rankCandidates(evaluations);
}
