import type {
  AttendeeProfile,
  BehaviorSettings,
  DestinationType,
  DwellDurationRange,
  Festival,
  Point,
  Vendor,
} from "../../domain";
import { minimumVendorPriceFactor } from "../../domain";
import type { RandomStream } from "../random";

export interface ResolvedDestination {
  id: string;
  type: DestinationType;
  position: Point;
  vendor?: Vendor;
  attraction: number;
  dwellDurationSeconds?: DwellDurationRange;
}

export interface DestinationSelectionState {
  completedStops: number;
  vendorStops: number;
  stageStops: number;
  amenityStops: number;
  lastDestinationId: string | null;
  visitsByDestination: ReadonlyMap<string, number>;
  remainingBudget: number;
  position: Point;
  timeSeconds: number;
  visitDeadlineSeconds: number;
}

export interface DestinationSelection {
  destination?: ResolvedDestination;
  reason?:
    | "itinerary_limit"
    | "no_eligible_destination"
    | "insufficient_time"
    | "insufficient_budget";
}

function amenityType(type: DestinationType): boolean {
  return type === "restroom" || type === "seating" || type === "first_aid";
}

export function resolveDestinations(
  festival: Festival,
  settings: BehaviorSettings,
): ResolvedDestination[] {
  const stages: ResolvedDestination[] = festival.stages.map((stage) => ({
    id: stage.id,
    type: "stage",
    position: { ...stage.position },
    attraction: stage.attraction,
    dwellDurationSeconds: {
      ...(stage.dwellDurationOverrideSeconds ??
        settings.dwellDurationSeconds.stage),
    },
  }));
  const vendors: ResolvedDestination[] = festival.vendors.map((vendor) => ({
    id: vendor.id,
    type: "vendor",
    position: { ...vendor.position },
    attraction: vendor.popularity,
    vendor,
  }));
  const amenities: ResolvedDestination[] = (festival.amenities ?? []).map(
    (amenity) => ({
      id: amenity.id,
      type: amenity.type,
      position: { ...amenity.position },
      attraction: amenity.attraction,
      dwellDurationSeconds: {
        ...(amenity.dwellDurationOverrideSeconds ??
          settings.dwellDurationSeconds[amenity.type]),
      },
    }),
  );

  return [...stages, ...vendors, ...amenities].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

/** The approved CON-02 vendor formula, before optional intent preference. */
export function calculateVendorUtility(
  vendor: Vendor,
  profile: AttendeeProfile,
  settings: BehaviorSettings,
  remainingBudget: number,
): number {
  if (vendor.averagePrice > remainingBudget) return 0;
  const priceFactor = minimumVendorPriceFactor(
    settings.priceElasticity,
    profile.priceSensitivity,
    vendor.averagePrice,
    remainingBudget,
  );
  return (
    settings.destinationTypeWeights.vendor *
    profile.vendorCategoryWeights[vendor.category] *
    Math.max(0, vendor.popularity) *
    priceFactor
  );
}

function intentMultiplier(
  profile: AttendeeProfile,
  type: DestinationType,
  completedStops: number,
): number {
  if (completedStops > 0) return 1;
  if (profile.intent === "stage_first" && type === "stage") return 4;
  if (profile.intent === "vendor_first" && type === "vendor") return 4;
  if (profile.intent === "amenity_first" && amenityType(type)) return 4;
  return 1;
}

function destinationUtility(
  destination: ResolvedDestination,
  profile: AttendeeProfile,
  settings: BehaviorSettings,
  state: DestinationSelectionState,
): number {
  let utility: number;
  if (destination.type === "vendor") {
    utility = calculateVendorUtility(
      destination.vendor!,
      profile,
      settings,
      state.remainingBudget,
    );
  } else if (destination.type === "stage") {
    utility =
      settings.destinationTypeWeights.stage *
      profile.destinationTypeWeights.stage *
      Math.max(0, destination.attraction) *
      profile.stageAttractionPreference;
  } else {
    utility =
      settings.destinationTypeWeights[destination.type] *
      profile.destinationTypeWeights[destination.type] *
      Math.max(0, destination.attraction) *
      (0.5 + profile.amenityTendency);
  }
  return utility * intentMultiplier(profile, destination.type, state.completedStops);
}

function minimumDurationSeconds(destination: ResolvedDestination): number {
  if (destination.type === "vendor") {
    return destination.vendor!.serviceTimeSeconds;
  }
  return destination.dwellDurationSeconds?.minimum ?? 0;
}

export function selectDestination(
  destinations: readonly ResolvedDestination[],
  profile: AttendeeProfile,
  settings: BehaviorSettings,
  state: DestinationSelectionState,
  walkingSpeedMetersPerSecond: number,
  inventoryRemaining: ReadonlyMap<string, number | null>,
  choice: Pick<RandomStream, "weightedIndex">,
): DestinationSelection {
  if (state.completedStops >= settings.maximumItineraryStops) {
    return { reason: "itinerary_limit" };
  }
  const remainingTime = state.visitDeadlineSeconds - state.timeSeconds;
  if (remainingTime + Number.EPSILON < settings.minimumRemainingTimeSeconds) {
    return { reason: "insufficient_time" };
  }

  let budgetBlocked = false;
  let timeBlocked = false;
  const candidates = destinations.filter((destination) => {
    if (destination.id === state.lastDestinationId) return false;
    if (
      (state.visitsByDestination.get(destination.id) ?? 0) >=
      settings.maximumVisitsPerDestination
    ) {
      return false;
    }
    if (
      (destination.type === "vendor" &&
        state.vendorStops >= settings.maximumVendorStops) ||
      (destination.type === "stage" &&
        state.stageStops >= settings.maximumStageStops) ||
      (amenityType(destination.type) &&
        state.amenityStops >= settings.maximumAmenityStops)
    ) {
      return false;
    }
    if (destination.type === "vendor") {
      const vendor = destination.vendor!;
      if (inventoryRemaining.get(vendor.id) === 0) return false;
      if (vendor.averagePrice > state.remainingBudget) {
        budgetBlocked = true;
        return false;
      }
    }
    const distance = Math.hypot(
      destination.position.x - state.position.x,
      destination.position.y - state.position.y,
    );
    const travelSeconds =
      distance === 0
        ? 0
        : walkingSpeedMetersPerSecond > 0
          ? distance / walkingSpeedMetersPerSecond
          : Number.POSITIVE_INFINITY;
    if (travelSeconds + minimumDurationSeconds(destination) > remainingTime) {
      timeBlocked = true;
      return false;
    }
    return true;
  });

  const weighted = candidates
    .map((destination) => ({
      destination,
      utility: destinationUtility(destination, profile, settings, state),
    }))
    .filter(({ utility }) => Number.isFinite(utility) && utility > 0);
  if (weighted.length === 0) {
    return {
      reason: timeBlocked
        ? "insufficient_time"
        : budgetBlocked
          ? "insufficient_budget"
          : "no_eligible_destination",
    };
  }
  return {
    destination:
      weighted[choice.weightedIndex(weighted.map(({ utility }) => utility))]!
        .destination,
  };
}

export function isAmenityDestination(type: DestinationType): boolean {
  return amenityType(type);
}
