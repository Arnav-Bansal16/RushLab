import type {
  AttendeeStatus,
  DestinationTarget,
  DestinationType,
  Festival,
  Id,
  Point,
} from "./model";
import type {
  AttendeeIntent,
  BehaviorSettings,
  BehaviorSettingsInput,
  DestinationTypeWeights,
  VendorCategoryWeights,
} from "./behavior";

export interface SimulationSettings {
  seed: number;
  attendeeCount: number;
  durationSeconds: number;
  stepSeconds: number;
  frameIntervalSeconds: number;
  walkingSpeedMetersPerSecond: number;
  /** Optional on schema-v1 input; every SimulationResult contains resolved defaults. */
  behavior?: BehaviorSettingsInput;
}

export type SimulationSettingsSnapshot = Omit<
  SimulationSettings,
  "behavior"
> & { behavior: BehaviorSettings };

export interface AttendeeProfile {
  id: Id;
  /** Stable key used to derive per-attendee choice draws across layouts. */
  choiceStreamKey: string;
  entranceId: Id;
  spawnTimeSeconds: number;
  intent: AttendeeIntent;
  destinationTypeWeights: DestinationTypeWeights;
  vendorCategoryWeights: VendorCategoryWeights;
  priceSensitivity: number;
  queueToleranceSeconds: number;
  walkingSpeedMultiplier: number;
  stageAttractionPreference: number;
  explorationTendency: number;
  amenityTendency: number;
  dwellDurationTendency: number;
  exitTendency: number;
  visitDurationToleranceSeconds: number;
  /** Immutable starting amount; runtime remaining budget is never written back. */
  initialBudget: number;
}

export interface QueueFrustration {
  vendorId: Id;
  reason: "wait_too_long" | "queue_full";
  timeSeconds: number;
  missedSaleValue: number;
}
export interface AttendeeFrameState {
  /** Engine-supplied presentation marker, visible for 15 simulated seconds. */
  queueFrustration?: QueueFrustration;
  id: Id;
  position: Point;
  status: AttendeeStatus;
  targetVendorId: Id | null;
  /** Generic target used by multi-destination playback. */
  target?: DestinationTarget | null;
  completedStops?: number;
  remainingBudget?: number;
}
export interface VendorFrameState {
  /** Event-derived values through this recorded timestamp; absent on legacy frames. */
  cumulativeRevenue?: number;
  cumulativeMissedSales?: number;
  cumulativeMissedSaleValue?: number;
  queueFull?: boolean;
  vendorId: Id;
  queueLength: number;
  inventoryRemaining: number | null;
  cumulativeSales: number;
}
export interface SimulationFrame {
  timeSeconds: number;
  attendees: AttendeeFrameState[];
  vendors: VendorFrameState[];
}

export type ExitReason =
  | "itinerary_limit"
  | "no_eligible_destination"
  | "insufficient_time"
  | "insufficient_budget"
  | "queue_tolerance_exceeded"
  | "seeded_exit_decision"
  | "run_ended";

export type SimulationEvent =
  | ({ type: "missed_sale"; attendeeId: Id } & QueueFrustration)
  | { type: "spawn"; timeSeconds: number; attendeeId: Id; entranceId: Id }
  | { type: "queue_join"; timeSeconds: number; attendeeId: Id; vendorId: Id }
  | {
      type: "queue_abandon";
      timeSeconds: number;
      attendeeId: Id;
      vendorId: Id;
      waitedSeconds: number;
    }
  | { type: "service_start"; timeSeconds: number; attendeeId: Id; vendorId: Id }
  | {
      type: "purchase";
      timeSeconds: number;
      attendeeId: Id;
      vendorId: Id;
      amount: number;
      remainingBudget?: number;
      inventoryRemaining?: number | null;
    }
  | {
      type: "destination_visit_start";
      timeSeconds: number;
      attendeeId: Id;
      destinationId: Id;
      destinationType: DestinationType;
      visitOrder: number;
      isRepeatVisit: boolean;
    }
  | {
      type: "destination_visit_end";
      timeSeconds: number;
      attendeeId: Id;
      destinationId: Id;
      destinationType: DestinationType;
      visitOrder: number;
      durationSeconds: number;
      truncated: boolean;
    }
  | { type: "stockout"; timeSeconds: number; vendorId: Id }
  | {
      type: "exit";
      timeSeconds: number;
      attendeeId: Id;
      reason?: ExitReason;
      completedStops?: number;
      remainingBudget?: number;
    };

export interface VendorMetrics {
  /** Modeled missed-sale opportunities, not actual revenue or festival losses. */
  missedSales?: { count: number; value: number };
  vendorId: Id;
  visits: number;
  queueJoins: number;
  purchases: number;
  abandonments: number;
  revenue: number;
  averageWaitSeconds: number;
  maximumQueueLength: number;
  utilization: number;
  stockoutTimeSeconds: number | null;
}

export interface DestinationMetrics {
  destinationId: Id;
  destinationType: DestinationType;
  visits: number;
  uniqueVisitors: number;
  repeatVisits: number;
  completedDwellSeconds: number;
  truncatedDwellSeconds: number;
}

export interface DestinationTransitionMetrics {
  fromType: DestinationType;
  toType: DestinationType;
  count: number;
}

/** Explicit engine policies that affect whether two modeled runs are comparable. */
export interface SimulationModelSemantics {
  itineraryPolicy: "bounded_multi_destination_v1";
  queueDeparturePolicy: "reselect_after_queue_departure";
  queueFullPolicy: "record_missed_sale_and_reselect_v1";
  frustrationPolicy: "queue_departure_marker_v1";
  missedSalePolicy: "queue_departure_opportunity_v1";
}

export const CURRENT_SIMULATION_MODEL_SEMANTICS: Readonly<SimulationModelSemantics> =
  Object.freeze({
    itineraryPolicy: "bounded_multi_destination_v1",
    queueDeparturePolicy: "reselect_after_queue_departure",
    queueFullPolicy: "record_missed_sale_and_reselect_v1",
    frustrationPolicy: "queue_departure_marker_v1",
    missedSalePolicy: "queue_departure_opportunity_v1",
  });

export interface SimulationResult {
  schemaVersion: 1;
  festivalId: Id;
  /** Exact immutable run input; comparison uses it for non-layout assumptions. */
  festival: Festival;
  modelSemantics: SimulationModelSemantics;
  settings: SimulationSettingsSnapshot;
  attendeeProfiles: AttendeeProfile[];
  frames: SimulationFrame[];
  events: SimulationEvent[];
  vendorMetrics: VendorMetrics[];
  /** ANA-03 derives these from destination events, never from frames. */
  destinationMetrics: DestinationMetrics[];
  destinationTransitions: DestinationTransitionMetrics[];
  totals: {
    purchases: number;
    revenue: number;
    abandonments: number;
    exitedAttendees: number;
  };
}

export type MetricUnavailableReason = "entity_absent" | "metric_not_recorded";
export type MetricNotApplicableReason = "no_stockout";

export type NumericMetricValue =
  | { status: "available"; value: number }
  | { status: "unavailable"; reason: MetricUnavailableReason }
  | { status: "not_applicable"; reason: MetricNotApplicableReason };

export type NumericMetricDelta =
  | { status: "available"; value: number }
  | {
      status: "unavailable";
      reason:
        | MetricUnavailableReason
        | "source_value_unavailable"
        | "non_finite_result";
    }
  | { status: "not_applicable"; reason: MetricNotApplicableReason };

export type PercentageMetricDelta =
  | { status: "available"; value: number }
  | {
      status: "not_applicable";
      reason: "zero_baseline" | MetricNotApplicableReason;
    }
  | {
      status: "unavailable";
      reason: "source_value_unavailable" | "non_finite_result";
    };

export interface NumericMetricComparison<MetricKey extends string = string> {
  metric: MetricKey;
  baseline: NumericMetricValue;
  alternative: NumericMetricValue;
  absoluteDelta: NumericMetricDelta;
  percentageDelta: PercentageMetricDelta;
}

export type RunTotalMetricKey =
  "purchases" | "revenue" | "abandonments" | "exitedAttendees";
export type VendorMetricKey =
  | "visits"
  | "queueJoins"
  | "purchases"
  | "abandonments"
  | "revenue"
  | "averageWaitSeconds"
  | "maximumQueueLength"
  | "utilization"
  | "stockoutTimeSeconds"
  | "missedSaleCount"
  | "missedSaleValue";
export type DestinationMetricKey =
  | "visits"
  | "uniqueVisitors"
  | "repeatVisits"
  | "completedDwellSeconds"
  | "truncatedDwellSeconds";
export type DestinationTransitionMetricKey = "count";

export type EntityPresence = "both" | "baseline_only" | "alternative_only";

export interface VendorComparison {
  vendorId: Id;
  presence: EntityPresence;
  metrics: NumericMetricComparison<VendorMetricKey>[];
}

export interface DestinationComparison {
  destinationId: Id;
  destinationType: DestinationType;
  presence: EntityPresence;
  metrics: NumericMetricComparison<DestinationMetricKey>[];
}

export interface DestinationTransitionComparison {
  fromType: DestinationType;
  toType: DestinationType;
  presence: EntityPresence;
  metrics: NumericMetricComparison<DestinationTransitionMetricKey>[];
}

export type CompatibilityIssueCode =
  | "unsupported_schema"
  | "missing_festival_snapshot"
  | "missing_model_semantics"
  | "model_semantics_mismatch"
  | "settings_mismatch"
  | "attendee_profiles_mismatch"
  | "duplicate_result_entity"
  | "festival_assumption_mismatch"
  | "invalid_profile_entrance"
  | "entity_only_on_one_side"
  | "optional_metric_unavailable";

export interface CompatibilityIssue {
  code: CompatibilityIssueCode;
  path: string;
  message: string;
}

export interface ScenarioCompatibility {
  status: "compatible" | "incompatible";
  errors: CompatibilityIssue[];
  warnings: CompatibilityIssue[];
}

export interface ScenarioReference {
  festivalId: Id;
  seed: number;
}

export interface ScenarioComparison {
  baseline: ScenarioReference;
  alternative: ScenarioReference;
  compatibility: ScenarioCompatibility;
  /** Null when hard incompatibilities prevent a fair modeled comparison. */
  totals: NumericMetricComparison<RunTotalMetricKey>[] | null;
  vendors: VendorComparison[] | null;
  destinations: DestinationComparison[] | null;
  destinationTransitions: DestinationTransitionComparison[] | null;
}

export interface RecommendationEvidence {
  metric: keyof VendorMetrics | "distanceToEntrance" | "nearbyCongestion";
  value: number;
  threshold?: number;
}
export interface PlacementRecommendation {
  id: Id;
  vendorId: Id;
  kind: "move" | "increase_capacity" | "reduce_capacity" | "monitor";
  proposedPosition?: Point;
  rationale: string;
  evidence: RecommendationEvidence[];
  expectedImpact: "low" | "medium" | "high";
}

export type RunSimulation = (
  festival: Festival,
  settings: SimulationSettings,
) => SimulationResult;
export type CompareScenarios = (
  baseline: SimulationResult,
  alternative: SimulationResult,
) => ScenarioComparison;
export type RecommendPlacements = (
  festival: Festival,
  result: SimulationResult,
) => PlacementRecommendation[];
