import type {
  AmenityType,
  DestinationType,
  DwellDurationRange,
  VendorCategory,
} from "./model";

export type AttendeeIntent =
  | "stage_first"
  | "vendor_first"
  | "explorer"
  | "amenity_first";

export type IntentWeights = Record<AttendeeIntent, number>;
export type DestinationTypeWeights = Record<DestinationType, number>;
export type VendorCategoryWeights = Record<VendorCategory, number>;
export type DwellDurationRanges = Record<
  "stage" | AmenityType,
  DwellDurationRange
>;

export interface BehaviorSettings {
  maximumItineraryStops: number;
  maximumVendorStops: number;
  maximumStageStops: number;
  maximumAmenityStops: number;
  /** One disables revisits. Values above one explicitly enable bounded revisits. */
  maximumVisitsPerDestination: number;
  roamingWaypoints: number;
  queueToleranceMultiplier: number;
  priceElasticity: number;
  deterministicExitProbabilityAfterStop: number;
  minimumRemainingTimeSeconds: number;
  intentWeights: IntentWeights;
  destinationTypeWeights: DestinationTypeWeights;
  vendorCategoryWeights: VendorCategoryWeights;
  dwellDurationSeconds: DwellDurationRanges;
}

export interface BehaviorSettingsInput
  extends Partial<
    Omit<
      BehaviorSettings,
      | "intentWeights"
      | "destinationTypeWeights"
      | "vendorCategoryWeights"
      | "dwellDurationSeconds"
    >
  > {
  intentWeights?: Partial<IntentWeights>;
  destinationTypeWeights?: Partial<DestinationTypeWeights>;
  vendorCategoryWeights?: Partial<VendorCategoryWeights>;
  dwellDurationSeconds?: Partial<DwellDurationRanges>;
}

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
  maximumItineraryStops: 4,
  maximumVendorStops: 2,
  maximumStageStops: 2,
  maximumAmenityStops: 2,
  maximumVisitsPerDestination: 1,
  roamingWaypoints: 1,
  queueToleranceMultiplier: 1,
  priceElasticity: 1,
  deterministicExitProbabilityAfterStop: 0.08,
  minimumRemainingTimeSeconds: 30,
  intentWeights: {
    stage_first: 0.4,
    vendor_first: 0.35,
    explorer: 0.15,
    amenity_first: 0.1,
  },
  destinationTypeWeights: {
    stage: 1,
    vendor: 0.85,
    restroom: 0.25,
    seating: 0.18,
    first_aid: 0.02,
  },
  vendorCategoryWeights: {
    food: 1,
    drink: 1,
    merchandise: 0.65,
    activity: 0.5,
    other: 0.4,
  },
  dwellDurationSeconds: {
    stage: { minimum: 30, maximum: 120 },
    restroom: { minimum: 45, maximum: 120 },
    seating: { minimum: 30, maximum: 180 },
    first_aid: { minimum: 60, maximum: 300 },
  },
};

const WEIGHT_MAXIMUM = 10;

function finiteInRange(
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be finite and between ${minimum} and ${maximum}`);
  }
}

function validateWeights(
  weights: Record<string, number>,
  name: string,
): void {
  for (const [key, value] of Object.entries(weights)) {
    finiteInRange(value, 0, WEIGHT_MAXIMUM, `${name}.${key}`);
  }
}

export function validateBehaviorSettings(settings: BehaviorSettings): void {
  if (
    !Number.isInteger(settings.maximumItineraryStops) ||
    settings.maximumItineraryStops < 1 ||
    settings.maximumItineraryStops > 6
  ) {
    throw new Error("maximumItineraryStops must be an integer from 1 through 6");
  }
  for (const [name, value] of [
    ["maximumVendorStops", settings.maximumVendorStops],
    ["maximumStageStops", settings.maximumStageStops],
    ["maximumAmenityStops", settings.maximumAmenityStops],
  ] as const) {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > settings.maximumItineraryStops
    ) {
      throw new Error(
        `${name} must be an integer from 0 through maximumItineraryStops`,
      );
    }
  }
  if (
    !Number.isInteger(settings.maximumVisitsPerDestination) ||
    settings.maximumVisitsPerDestination < 1 ||
    settings.maximumVisitsPerDestination > settings.maximumItineraryStops
  ) {
    throw new Error(
      "maximumVisitsPerDestination must be an integer from 1 through maximumItineraryStops",
    );
  }
  if (
    !Number.isInteger(settings.roamingWaypoints) ||
    settings.roamingWaypoints < 0 ||
    settings.roamingWaypoints > 2
  ) {
    throw new Error("roamingWaypoints must be an integer from 0 through 2");
  }
  finiteInRange(settings.queueToleranceMultiplier, 0, 5, "queueToleranceMultiplier");
  finiteInRange(settings.priceElasticity, 0, 10, "priceElasticity");
  finiteInRange(
    settings.deterministicExitProbabilityAfterStop,
    0,
    1,
    "deterministicExitProbabilityAfterStop",
  );
  finiteInRange(
    settings.minimumRemainingTimeSeconds,
    0,
    3_600,
    "minimumRemainingTimeSeconds",
  );
  validateWeights(settings.intentWeights, "intentWeights");
  validateWeights(settings.destinationTypeWeights, "destinationTypeWeights");
  validateWeights(settings.vendorCategoryWeights, "vendorCategoryWeights");
  for (const [type, range] of Object.entries(settings.dwellDurationSeconds)) {
    finiteInRange(range.minimum, 0, 3_600, `${type}.minimum`);
    finiteInRange(range.maximum, 0, 3_600, `${type}.maximum`);
    if (range.minimum > range.maximum) {
      throw new Error(`${type} dwell minimum must not exceed its maximum`);
    }
  }
}

export function resolveBehaviorSettings(
  input: BehaviorSettingsInput | undefined,
): BehaviorSettings {
  const resolved: BehaviorSettings = {
    ...DEFAULT_BEHAVIOR_SETTINGS,
    ...input,
    intentWeights: {
      ...DEFAULT_BEHAVIOR_SETTINGS.intentWeights,
      ...input?.intentWeights,
    },
    destinationTypeWeights: {
      ...DEFAULT_BEHAVIOR_SETTINGS.destinationTypeWeights,
      ...input?.destinationTypeWeights,
    },
    vendorCategoryWeights: {
      ...DEFAULT_BEHAVIOR_SETTINGS.vendorCategoryWeights,
      ...input?.vendorCategoryWeights,
    },
    dwellDurationSeconds: {
      ...DEFAULT_BEHAVIOR_SETTINGS.dwellDurationSeconds,
      ...input?.dwellDurationSeconds,
    },
  };
  validateBehaviorSettings(resolved);
  return resolved;
}

export function minimumVendorPriceFactor(
  priceElasticity: number,
  priceSensitivity: number,
  averagePrice: number,
  remainingBudget: number,
): number {
  return Math.exp(
    -priceElasticity *
      priceSensitivity *
      (averagePrice / Math.max(remainingBudget, 0.01)),
  );
}
