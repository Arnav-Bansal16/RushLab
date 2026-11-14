import type { Festival, SimulationSettings } from "@/domain";
import type { LayoutDocument } from "./layout";

/** Copy only the approved engine contract. No editor annotations or shared references. */
export function snapshotFestival(layout: LayoutDocument): Festival {
  return structuredClone({
    schemaVersion: layout.schemaVersion,
    id: layout.id,
    name: layout.name,
    boundsMeters: layout.boundsMeters,
    entrances: layout.entrances,
    stages: layout.stages,
    paths: layout.paths,
    obstacles: layout.obstacles,
    vendors: layout.vendors,
  });
}

/** Input checks only; no movement, metrics, randomness, or simulation decisions. */
export function validateSimulationFestival(festival: Festival): string[] {
  const issues: string[] = [];
  const finite = (value: number) => Number.isFinite(value);
  const positive = (value: number) => finite(value) && value > 0;
  const nonnegative = (value: number) => finite(value) && value >= 0;
  const inBounds = (point: { x: number; y: number }) =>
    nonnegative(point.x) &&
    nonnegative(point.y) &&
    point.x <= festival.boundsMeters.width &&
    point.y <= festival.boundsMeters.height;
  const sizeValid = (
    size: { width: number; height: number },
    point: { x: number; y: number },
  ) =>
    positive(size.width) &&
    positive(size.height) &&
    inBounds(point) &&
    point.x + size.width <= festival.boundsMeters.width &&
    point.y + size.height <= festival.boundsMeters.height;
  if (festival.schemaVersion !== 1)
    issues.push("Unsupported festival schema version.");
  if (!festival.id.trim() || !festival.name.trim())
    issues.push("Event ID and name must not be blank.");
  if (
    !positive(festival.boundsMeters.width) ||
    !positive(festival.boundsMeters.height)
  )
    issues.push("Site dimensions must be finite positive meters.");
  const entities = [
    ...festival.entrances,
    ...festival.stages,
    ...festival.vendors,
    ...festival.paths,
    ...festival.obstacles,
  ];
  const ids = [festival.id, ...entities.map((entity) => entity.id)];
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
    issues.push("All event and component IDs must be nonempty and unique.");
  if (!festival.entrances.length)
    issues.push("Add an entrance gate before sending this layout to SIM-01.");
  if (
    festival.entrances.length &&
    !festival.entrances.some((gate) => positive(gate.spawnWeight))
  )
    issues.push("At least one entrance needs a positive spawn weight.");
  for (const gate of festival.entrances)
    if (!inBounds(gate.position) || !nonnegative(gate.spawnWeight))
      issues.push(`Entrance ${gate.id} has invalid position or spawn weight.`);
  for (const stage of festival.stages)
    if (
      !sizeValid(stage.size, stage.position) ||
      !nonnegative(stage.attraction)
    )
      issues.push(`Stage ${stage.id} has invalid geometry or attraction.`);
  for (const vendor of festival.vendors) {
    if (!sizeValid(vendor.size, vendor.position))
      issues.push(`Vendor ${vendor.id} has invalid geometry.`);
    if (
      !["food", "drink", "merchandise", "activity", "other"].includes(
        vendor.category,
      ) ||
      !nonnegative(vendor.popularity) ||
      !nonnegative(vendor.averagePrice) ||
      !positive(vendor.serviceTimeSeconds) ||
      !Number.isSafeInteger(vendor.servers) ||
      vendor.servers < 1 ||
      (vendor.inventory !== null &&
        (!Number.isSafeInteger(vendor.inventory) || vendor.inventory < 0)) ||
      (vendor.queueLimit !== null &&
        (!Number.isSafeInteger(vendor.queueLimit) || vendor.queueLimit < 0))
    )
      issues.push(
        `Vendor ${vendor.id} has invalid service or inventory settings.`,
      );
  }
  for (const path of festival.paths)
    if (
      path.points.length < 2 ||
      !positive(path.widthMeters) ||
      !path.points.every(inBounds)
    )
      issues.push(
        `Walkway ${path.id} needs valid points in meters and a positive thickness.`,
      );
  for (const obstacle of festival.obstacles)
    if (obstacle.points.length < 3 || !obstacle.points.every(inBounds))
      issues.push(
        `Obstacle ${obstacle.id} needs at least three valid points in meters.`,
      );
  return issues;
}

export type PreparedSimulationInput =
  | {
      ok: true;
      festival: Festival;
      settings: SimulationSettings;
      warnings: string[];
    }
  | { ok: false; errors: string[]; warnings: string[] };

/** Stable handoff: caller supplies the agreed settings, then uses runSimulation(festival, settings). */
export function prepareSimulationInput(
  layout: LayoutDocument,
  settings: SimulationSettings,
): PreparedSimulationInput {
  const festival = snapshotFestival(layout);
  const errors = validateSimulationFestival(festival);
  if (!Number.isSafeInteger(settings.seed))
    errors.push("Seed must be a safe integer.");
  if (
    !Number.isSafeInteger(settings.attendeeCount) ||
    settings.attendeeCount < 0 ||
    settings.attendeeCount > 300
  )
    errors.push("P0 attendee count must be an integer from 0 to 300.");
  for (const key of [
    "durationSeconds",
    "stepSeconds",
    "frameIntervalSeconds",
    "walkingSpeedMetersPerSecond",
  ] as const)
    if (!Number.isFinite(settings[key]) || settings[key] <= 0)
      errors.push(`${key} must be finite and positive.`);
  if (settings.stepSeconds > settings.durationSeconds)
    errors.push("Simulation step must not exceed duration.");
  if (settings.frameIntervalSeconds < settings.stepSeconds)
    errors.push("Frame interval must not be shorter than the simulation step.");
  const warnings = layout.editor.elements.length
    ? [
        "Exits and custom areas are visual annotations only; the simulation receives no exit-routing or custom-area behavior.",
      ]
    : [];
  return errors.length
    ? { ok: false, errors, warnings }
    : { ok: true, festival, settings: structuredClone(settings), warnings };
}
