import type {
  AttendeeStatus,
  Festival,
  Id,
  Point,
  VendorCategory,
} from "./model";

export interface SimulationSettings {
  seed: number;
  attendeeCount: number;
  durationSeconds: number;
  stepSeconds: number;
  frameIntervalSeconds: number;
  walkingSpeedMetersPerSecond: number;
}

export interface AttendeeProfile {
  id: Id;
  entranceId: Id;
  spawnTimeSeconds: number;
  budget: number;
  categoryWeights: Record<VendorCategory, number>;
  priceSensitivity: number;
  queueToleranceSeconds: number;
  exploration: number;
}

export interface AttendeeFrameState {
  id: Id;
  position: Point;
  status: AttendeeStatus;
  targetVendorId: Id | null;
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
    }
  | { type: "stockout"; timeSeconds: number; vendorId: Id }
  | { type: "exit"; timeSeconds: number; attendeeId: Id };

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

export interface SimulationResult {
  schemaVersion: 1;
  festivalId: Id;
  settings: SimulationSettings;
  attendeeProfiles: AttendeeProfile[];
  frames: SimulationFrame[];
  events: SimulationEvent[];
  vendorMetrics: VendorMetrics[];
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
