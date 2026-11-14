import type {
  AttendeeFrameState,
  AttendeeProfile,
  Festival,
  Id,
  Point,
  RunSimulation,
  SimulationEvent,
  SimulationFrame,
  SimulationSettings,
  Vendor,
} from "../domain";
import { deriveSimulationMetrics } from "../analytics/metrics";
import { appendOrderedEvents } from "./events/order";
import { clampToBounds, createRoute, moveToward } from "./movement";
import { createAttendeeProfiles } from "./profiles";
import {
  admitRequest,
  completePurchase,
  createVendorQueueState,
  hasQueueTimedOut,
  hasServiceInventory,
  releaseServiceSlot,
  removeWaitingRequest,
  startNextRequest,
  type VendorQueueState,
} from "./queue/vendorQueue";
import {
  createNamedRandomStreams,
  type NamedRandomStreams,
  type RandomStream,
} from "./random";

interface AttendeeState extends AttendeeFrameState {
  entranceId: Id;
  spawnTimeSeconds: number;
  route: Point[];
  routeIndex: number;
  destinationIndex: number;
  requestOpen: boolean;
}

interface VendorArrival {
  attendee: AttendeeState;
  vendorId: Id;
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
  choice: NamedRandomStreams["choice"],
): Vendor | undefined {
  const available = vendors.filter(
    (vendor) => vendor.inventory === null || vendor.inventory > 0,
  );
  if (available.length === 0) return undefined;
  return available[
    choice.weightedIndex(
      available.map(
        (vendor) =>
          profile.categoryWeights[vendor.category] *
          Math.max(0, vendor.popularity),
      ),
    )
  ];
}

export function sampleServiceDurationSeconds(
  baseSeconds: number,
  stepSeconds: number,
  service: Pick<RandomStream, "float">,
): number {
  const modeledSeconds =
    Math.max(0, baseSeconds) * (0.8 + service.float() * 0.4);
  return Math.max(
    stepSeconds,
    Math.ceil((modeledSeconds - Number.EPSILON) / stepSeconds) * stepSeconds,
  );
}

function beginLeaving(attendee: AttendeeState): void {
  attendee.status = "leaving";
  attendee.targetVendorId = null;
  attendee.routeIndex = attendee.destinationIndex + 1;
}

function exitAttendee(
  attendee: AttendeeState,
  entrancePosition: Point,
  timeSeconds: number,
  stepEvents: SimulationEvent[],
): void {
  if (attendee.status === "exited") return;
  attendee.position = { ...entrancePosition };
  attendee.status = "exited";
  attendee.targetVendorId = null;
  attendee.requestOpen = false;
  stepEvents.push({ type: "exit", timeSeconds, attendeeId: attendee.id });
}

function snapshotFrame(
  timeSeconds: number,
  attendees: Map<Id, AttendeeState>,
  vendors: Vendor[],
  queues: Map<Id, VendorQueueState>,
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
    vendors: vendors.map((vendor) => {
      const queue = queues.get(vendor.id)!;
      return {
        vendorId: vendor.id,
        queueLength: queue.waiting.length,
        inventoryRemaining: queue.inventoryRemaining,
        cumulativeSales: queue.cumulativeSales,
      };
    }),
  };
}

function processServiceCompletions(
  timeSeconds: number,
  vendors: Vendor[],
  queues: Map<Id, VendorQueueState>,
  attendees: Map<Id, AttendeeState>,
  stepEvents: SimulationEvent[],
): void {
  for (const vendor of vendors) {
    const queue = queues.get(vendor.id)!;
    const completed = queue.active
      .filter((slot) => slot.completesAtSeconds <= timeSeconds + Number.EPSILON)
      .sort((left, right) => left.attendeeId.localeCompare(right.attendeeId));

    for (const slot of completed) {
      const attendee = attendees.get(slot.attendeeId);
      if (!attendee) throw new Error(`Unknown attendee: ${slot.attendeeId}`);
      releaseServiceSlot(queue, attendee.id);
      const stockedOut = completePurchase(queue);
      attendee.requestOpen = false;
      beginLeaving(attendee);
      stepEvents.push({
        type: "purchase",
        timeSeconds,
        attendeeId: attendee.id,
        vendorId: vendor.id,
        amount: vendor.averagePrice,
      });
      if (stockedOut) {
        stepEvents.push({ type: "stockout", timeSeconds, vendorId: vendor.id });
      }
    }

    if (queue.inventoryRemaining === 0) {
      for (const entry of [...queue.waiting]) {
        removeWaitingRequest(queue, entry.attendeeId);
        const attendee = attendees.get(entry.attendeeId);
        if (attendee) {
          attendee.requestOpen = false;
          beginLeaving(attendee);
        }
        stepEvents.push({
          type: "queue_abandon",
          timeSeconds,
          attendeeId: entry.attendeeId,
          vendorId: vendor.id,
          waitedSeconds: timeSeconds - entry.joinedAtSeconds,
        });
      }
    }
  }
}

function processTimeouts(
  timeSeconds: number,
  queues: Map<Id, VendorQueueState>,
  profiles: Map<Id, AttendeeProfile>,
  attendees: Map<Id, AttendeeState>,
  stepEvents: SimulationEvent[],
): void {
  for (const queue of [...queues.values()].sort((left, right) =>
    left.vendorId.localeCompare(right.vendorId),
  )) {
    for (const entry of [...queue.waiting]) {
      const profile = profiles.get(entry.attendeeId);
      if (!profile) throw new Error(`Unknown profile: ${entry.attendeeId}`);
      const waitedSeconds = timeSeconds - entry.joinedAtSeconds;
      if (
        !hasQueueTimedOut(
          entry.joinedAtSeconds,
          timeSeconds,
          profile.queueToleranceSeconds,
        )
      ) {
        continue;
      }

      removeWaitingRequest(queue, entry.attendeeId);
      const attendee = attendees.get(entry.attendeeId);
      if (!attendee) throw new Error(`Unknown attendee: ${entry.attendeeId}`);
      attendee.requestOpen = false;
      beginLeaving(attendee);
      stepEvents.push({
        type: "queue_abandon",
        timeSeconds,
        attendeeId: entry.attendeeId,
        vendorId: queue.vendorId,
        waitedSeconds,
      });
    }
  }
}

function moveAttendees(
  timeSeconds: number,
  festival: Festival,
  settings: SimulationSettings,
  attendees: Map<Id, AttendeeState>,
  entrances: Map<Id, { position: Point }>,
  stepEvents: SimulationEvent[],
): VendorArrival[] {
  const arrivals: VendorArrival[] = [];
  for (const attendee of [...attendees.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (
      attendee.status === "queued" ||
      attendee.status === "purchasing" ||
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
    if (attendee.status === "entering") attendee.status = "walking";
    if (!movement.arrived) continue;

    if (
      attendee.status === "walking" &&
      attendee.routeIndex >= attendee.destinationIndex
    ) {
      if (attendee.targetVendorId) {
        arrivals.push({ attendee, vendorId: attendee.targetVendorId });
      } else {
        beginLeaving(attendee);
      }
      continue;
    }

    attendee.routeIndex += 1;
    if (attendee.routeIndex >= attendee.route.length) {
      const entrance = entrances.get(attendee.entranceId);
      if (!entrance)
        throw new Error(`Unknown entrance: ${attendee.entranceId}`);
      exitAttendee(attendee, entrance.position, timeSeconds, stepEvents);
    }
  }
  return arrivals;
}

function processArrivals(
  arrivals: VendorArrival[],
  timeSeconds: number,
  queues: Map<Id, VendorQueueState>,
  stepEvents: SimulationEvent[],
): void {
  arrivals.sort(
    (left, right) =>
      left.vendorId.localeCompare(right.vendorId) ||
      left.attendee.id.localeCompare(right.attendee.id),
  );
  for (const { attendee, vendorId } of arrivals) {
    const queue = queues.get(vendorId);
    if (!queue) throw new Error(`Unknown vendor: ${vendorId}`);
    const admitted = admitRequest(queue, {
      attendeeId: attendee.id,
      joinedAtSeconds: timeSeconds,
    });
    if (!admitted) {
      beginLeaving(attendee);
      continue;
    }
    attendee.status = "queued";
    attendee.requestOpen = true;
    stepEvents.push({
      type: "queue_join",
      timeSeconds,
      attendeeId: attendee.id,
      vendorId,
    });
  }
}

function startServices(
  timeSeconds: number,
  settings: SimulationSettings,
  vendors: Vendor[],
  queues: Map<Id, VendorQueueState>,
  attendees: Map<Id, AttendeeState>,
  service: RandomStream,
  stepEvents: SimulationEvent[],
): void {
  for (const vendor of vendors) {
    const queue = queues.get(vendor.id)!;
    while (
      queue.waiting.length > 0 &&
      queue.active.length < queue.serverCount &&
      hasServiceInventory(queue)
    ) {
      const duration = sampleServiceDurationSeconds(
        vendor.serviceTimeSeconds,
        settings.stepSeconds,
        service,
      );
      const slot = startNextRequest(queue, timeSeconds, timeSeconds + duration);
      if (!slot) break;
      const attendee = attendees.get(slot.attendeeId);
      if (!attendee) throw new Error(`Unknown attendee: ${slot.attendeeId}`);
      attendee.status = "purchasing";
      stepEvents.push({
        type: "service_start",
        timeSeconds,
        attendeeId: attendee.id,
        vendorId: vendor.id,
      });
    }
  }
}

function terminateOpenRequestsAtRunEnd(
  timeSeconds: number,
  attendees: Map<Id, AttendeeState>,
  queues: Map<Id, VendorQueueState>,
  entrances: Map<Id, { position: Point }>,
  stepEvents: SimulationEvent[],
): void {
  for (const attendee of [...attendees.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (!attendee.requestOpen) continue;
    for (const queue of queues.values()) {
      removeWaitingRequest(queue, attendee.id);
      if (queue.active.some((slot) => slot.attendeeId === attendee.id)) {
        releaseServiceSlot(queue, attendee.id);
      }
    }
    const entrance = entrances.get(attendee.entranceId);
    if (!entrance) throw new Error(`Unknown entrance: ${attendee.entranceId}`);
    exitAttendee(attendee, entrance.position, timeSeconds, stepEvents);
  }
}

export const runSimulation: RunSimulation = (festival, settings) => {
  validateSettings(settings);
  const streams = createNamedRandomStreams(settings.seed);
  const attendeeProfiles = createAttendeeProfiles(festival, settings, streams);
  const profileById = new Map(
    attendeeProfiles.map((profile) => [profile.id, profile]),
  );
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
  const queues = new Map(
    vendors.map((vendor) => [vendor.id, createVendorQueueState(vendor)]),
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
    const stepEvents: SimulationEvent[] = [];

    if (stepIndex === 0) {
      for (const vendor of vendors) {
        if (vendor.inventory === 0) {
          stepEvents.push({
            type: "stockout",
            timeSeconds,
            vendorId: vendor.id,
          });
        }
      }
    }

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
      attendees.set(profile.id, {
        id: profile.id,
        entranceId: entrance.id,
        spawnTimeSeconds: timeSeconds,
        position: clampToBounds(entrance.position, festival),
        status: "entering",
        targetVendorId: vendor?.id ?? null,
        route,
        routeIndex: 0,
        destinationIndex: Math.max(0, route.length - 2),
        requestOpen: false,
      });
      stepEvents.push({
        type: "spawn",
        timeSeconds,
        attendeeId: profile.id,
        entranceId: entrance.id,
      });
      profileIndex += 1;
    }

    if (stepIndex > 0) {
      processServiceCompletions(
        timeSeconds,
        vendors,
        queues,
        attendees,
        stepEvents,
      );
      processTimeouts(timeSeconds, queues, profileById, attendees, stepEvents);
      const arrivals = moveAttendees(
        timeSeconds,
        festival,
        settings,
        attendees,
        entrances,
        stepEvents,
      );
      processArrivals(arrivals, timeSeconds, queues, stepEvents);
      startServices(
        timeSeconds,
        settings,
        vendors,
        queues,
        attendees,
        streams.service,
        stepEvents,
      );

      if (stepIndex === totalSteps) {
        terminateOpenRequestsAtRunEnd(
          timeSeconds,
          attendees,
          queues,
          entrances,
          stepEvents,
        );
      }
    }

    appendOrderedEvents(events, stepEvents);
    if (timeSeconds + Number.EPSILON >= nextFrameTime) {
      frames.push(snapshotFrame(timeSeconds, attendees, vendors, queues));
      nextFrameTime += settings.frameIntervalSeconds;
    }
  }

  const aggregates = deriveSimulationMetrics(events, vendors, settings);
  return {
    schemaVersion: 1,
    festivalId: festival.id,
    settings: { ...settings },
    attendeeProfiles,
    frames,
    events,
    ...aggregates,
  };
};
