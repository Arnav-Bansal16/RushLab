import type { Festival, Id, Point } from "./model";
import type { ScenarioComparison, SimulationResult } from "./simulation";

/** ANA-02 output is modeled evidence, independent of playback frames. */
export interface IssueEvidence {
  source:
    | "vendorMetrics"
    | "destinationMetrics"
    | "destinationTransitions"
    | "events";
  metric: string;
  entityIds: Id[];
  value: number;
  unit: "seconds" | "count" | "ratio" | "currency";
  threshold: number;
  comparison: "gte" | "lte";
  minimumActivity: number;
  observedActivity: number;
}

export type IssueCategory =
  | "wait"
  | "queue"
  | "abandonment"
  | "utilization"
  | "stockout"
  | "frustration"
  | "missed_sales"
  | "underuse"
  | "overload"
  | "uneven_visits"
  | "uneven_dwell"
  | "weak_transition";

interface ActionSource {
  id: Id;
  vendorId: Id;
  sourceFindingIds: Id[];
}

export type CandidateAction = ActionSource &
  (
    { kind: "move"; position: Point } | { kind: "set_servers"; servers: number }
  );

export interface IssueFinding {
  id: Id;
  category: IssueCategory;
  severity: "low" | "medium" | "high";
  affectedEntityIds: Id[];
  evidence: IssueEvidence[];
  rationale: string;
  suggestedAction: string;
  actions: CandidateAction[];
  limitation: string;
}

export interface UnavailableEvidence {
  metric: string;
  entityIds: Id[];
  reason: string;
}

export interface IssueReport {
  version: 1;
  festivalId: Id;
  /** Immutable input snapshot prevents generating from stale editor state. */
  festival: Festival;
  findings: IssueFinding[];
  unavailableEvidence: UnavailableEvidence[];
  limitations: string[];
}

export type CandidateChange = { vendorId: Id } & (
  | { kind: "move"; before: Point; after: Point }
  | { kind: "set_servers"; before: number; after: number }
);

export interface LayoutCandidate {
  id: Id;
  sourceFindingIds: Id[];
  sourceActionIds: Id[];
  changes: CandidateChange[];
  rationale: string;
  festival: Festival;
}

export interface RejectedCandidateAction {
  actionId: Id;
  reason:
    | "unknown_vendor"
    | "invalid_capacity"
    | "out_of_bounds"
    | "obstacle_overlap"
    | "entity_overlap"
    | "duplicate"
    | "unchanged"
    | "unsupported_action"
    | "attempt_limit"
    | "candidate_limit";
  detail: string;
}

export interface CandidateGeneration {
  candidates: LayoutCandidate[];
  attempts: number;
  attemptLimit: number;
  rejectedActions: RejectedCandidateAction[];
  reasons: string[];
  outcome: "generated" | "no_findings" | "no_legal_candidates";
}

export type ObjectiveMetric =
  | "average_wait"
  | "abandonments_per_attendee"
  | "stockout_share"
  | "purchases_per_attendee"
  | "revenue_per_attendee"
  | "destination_coverage"
  | "frustration_per_attendee"
  | "missed_sale_value_per_attendee";

interface ObjectiveDefinition {
  metric: ObjectiveMetric;
  direction: "higher" | "lower";
  normalization: number;
  weight: number;
}

export type ObjectiveComponent = ObjectiveDefinition &
  (
    | {
        available: true;
        baseline: number;
        alternative: number;
        contribution: number;
      }
    | { available: false; reason: string }
  );

/** Raw deltas and percentage availability belong to canonical INT-01 comparison. */
export type SeedEvaluation =
  | {
      status: "succeeded";
      seed: number;
      baseline: SimulationResult;
      alternative: SimulationResult;
      comparison: ScenarioComparison;
      components: ObjectiveComponent[];
      objectiveDelta: number;
    }
  | {
      status: "failed";
      seed: number;
      stage: "baseline" | "alternative" | "comparison" | "objective";
      reasons: string[];
      baseline: SimulationResult | null;
      alternative: SimulationResult | null;
      comparison: ScenarioComparison | null;
      objectiveDelta: null;
      components: ObjectiveComponent[];
    };

export type CandidateEvaluation = {
  candidateId: Id;
  seeds: [SeedEvaluation, SeedEvaluation, SeedEvaluation];
} & (
  | { eligible: true; aggregateObjectiveDelta: number; failureReasons: [] }
  | { eligible: false; aggregateObjectiveDelta: null; failureReasons: string[] }
);

export interface CandidateRanking {
  orderedEligibleIds: Id[];
  /** Each group contains candidates with exactly equal aggregate scores. */
  tieGroups: Id[][];
  bestTestedId: Id | null;
  improvingId: Id | null;
  outcome:
    | "improved"
    | "no_improvement"
    | "no_successful_evaluation"
    | "no_candidates";
  evaluations: CandidateEvaluation[];
  limitations: string[];
}

/** Canonical ANA-02 composition for UI-03B; the UI chooses when to invoke it. */
export interface LayoutOptimization {
  issues: IssueReport;
  generation: CandidateGeneration;
  seeds: [number, number, number];
  ranking: CandidateRanking;
}
