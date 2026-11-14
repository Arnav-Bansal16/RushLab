import type {
  AttendeeIntent,
  Festival,
  SimulationSettings,
  AttendeeProfile,
} from "../domain";
import { resolveBehaviorSettings } from "../domain";
import type { NamedRandomStreams } from "./random";

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function variedWeight(base: number, draw: number): number {
  return round(Math.min(10, Math.max(0, base * (0.75 + draw * 0.5))));
}

export function createAttendeeProfiles(
  festival: Festival,
  settings: SimulationSettings,
  streams: Pick<NamedRandomStreams, "arrivals" | "profiles">,
): AttendeeProfile[] {
  const entrances = [...festival.entrances].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (settings.attendeeCount > 0 && entrances.length === 0) {
    throw new Error("At least one entrance is required to spawn attendees");
  }

  const finalStep = Math.floor(settings.durationSeconds / settings.stepSeconds);
  const idWidth = Math.max(3, String(settings.attendeeCount).length);
  const behavior = resolveBehaviorSettings(settings.behavior);
  const intents = Object.keys(behavior.intentWeights) as AttendeeIntent[];

  return Array.from({ length: settings.attendeeCount }, (_, index) => {
    const entrance =
      entrances[
        streams.arrivals.weightedIndex(
          entrances.map(({ spawnWeight }) => spawnWeight),
        )
      ];
    if (!entrance) {
      throw new Error("Unable to select an entrance");
    }

    // Preserve the legacy profile draw order through exploration so CON-02's
    // additive fields do not shift established SIM-02 queue scenarios.
    const vendorCategoryWeights = Object.fromEntries(
      Object.entries(behavior.vendorCategoryWeights).map(([category, weight]) => [
        category,
        variedWeight(weight, streams.profiles.float()),
      ]),
    ) as AttendeeProfile["vendorCategoryWeights"];
    const initialBudget = round(15 + streams.profiles.float() * 85, 2);
    const priceSensitivity = round(streams.profiles.float());
    const queueToleranceSeconds = round(
      30 + streams.profiles.float() * 270,
      2,
    );
    const explorationTendency = round(streams.profiles.float());
    const destinationTypeWeights = Object.fromEntries(
      Object.entries(behavior.destinationTypeWeights).map(([type, weight]) => [
        type,
        variedWeight(weight, streams.profiles.float()),
      ]),
    ) as AttendeeProfile["destinationTypeWeights"];

    const id = `attendee-${String(index + 1).padStart(idWidth, "0")}`;
    return {
      id,
      choiceStreamKey: `choice:${id}`,
      entranceId: entrance.id,
      spawnTimeSeconds:
        streams.arrivals.integer(0, finalStep) * settings.stepSeconds,
      intent:
        intents[
          streams.profiles.weightedIndex(
            intents.map((intent) => behavior.intentWeights[intent]),
          )
        ]!,
      destinationTypeWeights,
      vendorCategoryWeights,
      priceSensitivity,
      queueToleranceSeconds,
      walkingSpeedMultiplier: round(0.8 + streams.profiles.float() * 0.4),
      stageAttractionPreference: round(0.5 + streams.profiles.float()),
      explorationTendency,
      amenityTendency: round(streams.profiles.float()),
      dwellDurationTendency: round(0.75 + streams.profiles.float() * 0.5),
      exitTendency: round(streams.profiles.float()),
      visitDurationToleranceSeconds: round(
        900 + streams.profiles.float() * 6_300,
        2,
      ),
      initialBudget,
    };
  });
}
