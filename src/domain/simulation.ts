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

export interface AttendeeFrameState {
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

export interface SimulationResult {
  schemaVersion: 1;
  festivalId: Id;
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

export interface VendorMetricDelta {
  vendorId: Id;
  revenue: number;
  purchases: number;
  averageWaitSeconds: number;
  abandonments: number;
}
export interface ScenarioComparison {
  baseline: SimulationResult;
  alternative: SimulationResult;
  vendorDeltas: VendorMetricDelta[];
  totalDeltas: { revenue: number; purchases: number; abandonments: number };
  warnings: string[];
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
