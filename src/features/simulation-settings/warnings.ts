import type { BehaviorSettings, Festival } from "../../domain";

/** Input-only warning. Eligibility and destination choice stay in the engine. */
export function behaviorInputWarnings(
  festival: Festival,
  behavior: BehaviorSettings,
): string[] {
  const types = new Set([
    ...(festival.vendors.length ? ["vendor" as const] : []),
    ...(festival.stages.length ? ["stage" as const] : []),
    ...(festival.amenities ?? []).map((item) => item.type),
  ]);
  return types.size > 0 &&
    [...types].every((type) => behavior.destinationTypeWeights[type] === 0)
    ? [
        "All destination-type weights for destinations in this layout are zero. Guests will exit without a visit. Zero values are preserved.",
      ]
    : [];
}
