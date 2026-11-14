import type {
  AttendeeFrameState,
  AttendeeProfile,
  Id,
  Point,
  RunSimulation,
  SimulationEvent,
  SimulationFrame,
  SimulationSettings,
  Vendor,
} from "../domain";
import { clampToBounds, createRoute, moveToward } from "./movement";
import { createAttendeeProfiles } from "./profiles";
import { createNamedRandomStreams } from "./random";

interface AttendeeState extends AttendeeFrameState {
  entranceId: Id;
  spawnTimeSeconds: number;
  route: Point[];
  routeIndex: number;
  destinationIndex: number;
}

function validateSettings(settings: SimulationSettings): void {
  const finiteValues = [
    settings.seed,
    settings.attendeeCount,
    settings.durationSeconds,
    settings.stepSeconds,
    settings.frameIntervalSeconds,
    settings.walkingSpeedMetersPerSecond,
  ];
  if (!finiteValues.every(Number.isFinite)) {
    throw new Error("Simulation settings must be finite numbers");
  }
  if (!Number.isInteger(settings.attendeeCount) || settings.attendeeCount < 0) {
    throw new Error("attendeeCount must be a non-negative integer");
  }
  if (
    settings.durationSeconds < 0 ||
    settings.stepSeconds <= 0 ||
    settings.frameIntervalSeconds <= 0 ||
    settings.walkingSpeedMetersPerSecond < 0
  ) {
    throw new Error("Simulation duration and rates must be valid");
  }
}

function chooseVendor(
  profile: AttendeeProfile,
  vendors: Vendor[],
  choice: ReturnType<typeof createNamedRandomStreams>["choice"],
): Vendor | undefined {
  if (vendors.length === 0) return undefined;
  return vendors[
    choice.weightedIndex(
      vendors.map(
        (vendor) =>
          profile.categoryWeights[vendor.category] *
          Math.max(0, vendor.popularity),
      ),
    )
  ];
}

function snapshotFrame(
  timeSeconds: number,
  attendees: Map<Id, AttendeeState>,
  vendors: Vendor[],
): SimulationFrame {
  return {
    timeSeconds,
    attendees: [...attendees.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, position, status, targetVendorId }) => ({
        id,
        position: { ...position },
        status,
        targetVendorId,
      })),
    vendors: vendors.map((vendor) => ({
      vendorId: vendor.id,
      queueLength: 0,
      inventoryRemaining: vendor.inventory,
      cumulativeSales: 0,
    })),
  };
}

export const runSimulation: RunSimulation = (festival, settings) => {
  validateSettings(settings);
  const streams = createNamedRandomStreams(settings.seed);
  const attendeeProfiles = createAttendeeProfiles(festival, settings, streams);
  const profilesBySpawn = [...attendeeProfiles].sort(
    (left, right) =>
      left.spawnTimeSeconds - right.spawnTimeSeconds ||
      left.id.localeCompare(right.id),
  );
  const entrances = new Map(
    festival.entrances.map((entrance) => [entrance.id, entrance]),
  );
  const vendors = [...festival.vendors].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const attendees = new Map<Id, AttendeeState>();
  const events: SimulationEvent[] = [];
  const frames: SimulationFrame[] = [];
  const totalSteps = Math.floor(
    settings.durationSeconds / settings.stepSeconds,
  );
  let profileIndex = 0;
  let nextFrameTime = 0;

  for (let stepIndex = 0; stepIndex <= totalSteps; stepIndex += 1) {
    const timeSeconds = stepIndex * settings.stepSeconds;
    while (
      profileIndex < profilesBySpawn.length &&
      profilesBySpawn[profileIndex]!.spawnTimeSeconds <= timeSeconds
    ) {
      const profile = profilesBySpawn[profileIndex]!;
      const entrance = entrances.get(profile.entranceId);
      if (!entrance) throw new Error(`Unknown entrance: ${profile.entranceId}`);
      const vendor = chooseVendor(profile, vendors, streams.choice);
      const destination =
        vendor?.position ?? festival.stages[0]?.position ?? entrance.position;
      const route = createRoute(
        festival,
        entrance.position,
        destination,
        streams.movement,
      );
      const destinationIndex = Math.max(0, route.length - 2);
      attendees.set(profile.id, {
        id: profile.id,
        entranceId: entrance.id,
        spawnTimeSeconds: timeSeconds,
        position: clampToBounds(entrance.position, festival),
        status: "entering",
        targetVendorId: vendor?.id ?? null,
        route,
        routeIndex: 0,
        destinationIndex,
      });
      events.push({
        type: "spawn",
        timeSeconds,
        attendeeId: profile.id,
        entranceId: entrance.id,
      });
      profileIndex += 1;
    }

    if (stepIndex > 0) {
      for (const attendee of [...attendees.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      )) {
        if (
          attendee.status === "exited" ||
          attendee.spawnTimeSeconds === timeSeconds
        ) {
          continue;
        }
        const target = attendee.route[attendee.routeIndex];
        if (!target) continue;
        const movement = moveToward(
          attendee.position,
          target,
          settings.walkingSpeedMetersPerSecond * settings.stepSeconds,
        );
        attendee.position = clampToBounds(movement.position, festival);
        attendee.status =
          attendee.status === "entering" ? "walking" : attendee.status;
        if (!movement.arrived) continue;

        if (attendee.routeIndex >= attendee.destinationIndex) {
          attendee.status = "leaving";
          attendee.targetVendorId = null;
        }
        attendee.routeIndex += 1;
        if (attendee.routeIndex >= attendee.route.length) {
          attendee.status = "exited";
          events.push({
            type: "exit",
            timeSeconds,
            attendeeId: attendee.id,
          });
        }
      }
    }

    if (timeSeconds + Number.EPSILON >= nextFrameTime) {
      frames.push(snapshotFrame(timeSeconds, attendees, vendors));
      nextFrameTime += settings.frameIntervalSeconds;
    }
  }

  return {
    schemaVersion: 1,
    festivalId: festival.id,
    settings: { ...settings },
    attendeeProfiles,
    frames,
    events,
    vendorMetrics: vendors.map((vendor) => ({
      vendorId: vendor.id,
      visits: 0,
      queueJoins: 0,
      purchases: 0,
      abandonments: 0,
      revenue: 0,
      averageWaitSeconds: 0,
      maximumQueueLength: 0,
      utilization: 0,
      stockoutTimeSeconds: null,
    })),
    totals: {
      purchases: 0,
      revenue: 0,
      abandonments: 0,
      exitedAttendees: events.filter(({ type }) => type === "exit").length,
    },
  };
};
