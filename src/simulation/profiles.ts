import type {
  Festival,
  SimulationSettings,
  AttendeeProfile,
  VendorCategory,
} from "../domain";
import type { NamedRandomStreams } from "./random";

const CATEGORIES: VendorCategory[] = [
  "food",
  "drink",
  "merchandise",
  "activity",
  "other",
];

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
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

    const categoryWeights = Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        round(0.1 + streams.profiles.float() * 0.9),
      ]),
    ) as Record<VendorCategory, number>;

    return {
      id: `attendee-${String(index + 1).padStart(idWidth, "0")}`,
      entranceId: entrance.id,
      spawnTimeSeconds:
        streams.arrivals.integer(0, finalStep) * settings.stepSeconds,
      budget: round(15 + streams.profiles.float() * 85, 2),
      categoryWeights,
      priceSensitivity: round(streams.profiles.float()),
      queueToleranceSeconds: round(30 + streams.profiles.float() * 270, 2),
      exploration: round(streams.profiles.float()),
    };
  });
}
