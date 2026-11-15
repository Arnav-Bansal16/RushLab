import type {
  AttendeeFrameState,
  AttendeeProfile,
  ExitReason,
  Festival,
  Id,
  Point,
  RunSimulation,
  SimulationEvent,
  SimulationFrame,
  SimulationSettings,
  Vendor,
} from "../domain";
import { resolveBehaviorSettings } from "../domain";
import { deriveSimulationMetrics, withBusinessSnapshots } from "../analytics/metrics";
import {
  assignStableIntent,
  createAttendeeChoiceStream,
  createTravelRoute,
  generateRoamingWaypoints,
  resolveDestinations,
  sampleDwellDurationSeconds,
  selectDestination,
  type ResolvedDestination,
} from "./behavior";
import { appendOrderedEvents } from "./events/order";
import { clampToBounds, moveToward } from "./movement";
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
import { createNamedRandomStreams, type RandomStream } from "./random";

type ResolvedSettings = SimulationSettings & {
  behavior: ReturnType<typeof resolveBehaviorSettings>;
};

interface ActiveVisit {
  destination: ResolvedDestination;
  startedAtSeconds: number;
  visitOrder: number;
  dwellCompletesAtSeconds?: number;
}

interface AttendeeState extends AttendeeFrameState {
  entranceId: Id;
  spawnTimeSeconds: number;
  profile: AttendeeProfile;
  choice: RandomStream;
  route: Point[];
  routeIndex: number;
  roamingWaypointCount: number;
  requestOpen: boolean;
  activeVisit?: ActiveVisit;
  visitsByDestination: Map<Id, number>;
  vendorStops: number;
  stageStops: number;
  amenityStops: number;
  lastDestinationId: Id | null;
  exitReason?: ExitReason;
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

function finishVisit(
  attendee: AttendeeState,
  timeSeconds: number,
  truncated: boolean,
  stepEvents: SimulationEvent[],
): void {
  const visit = attendee.activeVisit;
  if (!visit) return;
  stepEvents.push({
    type: "destination_visit_end",
    timeSeconds,
    attendeeId: attendee.id,
    destinationId: visit.destination.id,
    destinationType: visit.destination.type,
    visitOrder: visit.visitOrder,
    durationSeconds: Math.max(0, timeSeconds - visit.startedAtSeconds),
    truncated,
  });
  if (!truncated) attendee.completedStops = (attendee.completedStops ?? 0) + 1;
  attendee.activeVisit = undefined;
}

function beginExit(
  attendee: AttendeeState,
  reason: ExitReason,
  festival: Festival,
  entrancePosition: Point,
  movement: RandomStream,
): void {
  attendee.status = "leaving";
  attendee.targetVendorId = null;
  attendee.target = null;
  attendee.exitReason = reason;
  attendee.route = createTravelRoute(
    festival,
    attendee.position,
    entrancePosition,
    movement,
  );
  attendee.routeIndex = 0;
  attendee.roamingWaypointCount = 0;
}

function exitAttendee(
  attendee: AttendeeState,
  timeSeconds: number,
  reason: ExitReason,
  stepEvents: SimulationEvent[],
  reachedEntrancePosition?: Point,
): void {
  if (attendee.status === "exited") return;
  if (reachedEntrancePosition) {
    attendee.position = { ...reachedEntrancePosition };
  }
  attendee.status = "exited";
  attendee.targetVendorId = null;
  attendee.target = null;
  attendee.requestOpen = false;
  stepEvents.push({
    type: "exit",
    timeSeconds,
    attendeeId: attendee.id,
    reason,
    completedStops: attendee.completedStops ?? 0,
    remainingBudget: attendee.remainingBudget ?? attendee.profile.initialBudget,
  });
}

function afterCompletedStop(
  attendee: AttendeeState,
  festival: Festival,
  settings: ResolvedSettings,
  entrancePosition: Point,
  movement: RandomStream,
): void {
  if ((attendee.completedStops ?? 0) >= settings.behavior.maximumItineraryStops) {
    beginExit(attendee, "itinerary_limit", festival, entrancePosition, movement);
    return;
  }
  const exitProbability =
    settings.behavior.deterministicExitProbabilityAfterStop *
    attendee.profile.exitTendency;
  if (attendee.choice.float() < exitProbability) {
    beginExit(
      attendee,
      "seeded_exit_decision",
      festival,
      entrancePosition,
      movement,
    );
    return;
  }
  attendee.status = "choosing";
  attendee.targetVendorId = null;
  attendee.target = null;
  attendee.route = [];
  attendee.routeIndex = 0;
  attendee.roamingWaypointCount = 0;
}

function startVisit(
  attendee: AttendeeState,
  destination: ResolvedDestination,
  timeSeconds: number,
  settings: SimulationSettings,
  stepEvents: SimulationEvent[],
): void {
  const previousVisits = attendee.visitsByDestination.get(destination.id) ?? 0;
  attendee.visitsByDestination.set(destination.id, previousVisits + 1);
  attendee.lastDestinationId = destination.id;
  if (destination.type === "vendor") attendee.vendorStops += 1;
  else if (destination.type === "stage") attendee.stageStops += 1;
  else attendee.amenityStops += 1;
  const visitOrder = (attendee.completedStops ?? 0) + 1;
  attendee.activeVisit = {
    destination,
    startedAtSeconds: timeSeconds,
    visitOrder,
  };
  stepEvents.push({
    type: "destination_visit_start",
    timeSeconds,
    attendeeId: attendee.id,
    destinationId: destination.id,
    destinationType: destination.type,
    visitOrder,
    isRepeatVisit: previousVisits > 0,
  });

  if (destination.type !== "vendor") {
    const duration = sampleDwellDurationSeconds(
      destination.dwellDurationSeconds!,
      attendee.profile.dwellDurationTendency,
      settings.stepSeconds,
      attendee.choice,
    );
    attendee.activeVisit.dwellCompletesAtSeconds = timeSeconds + duration;
    attendee.status = "dwelling";
  }
}

function planDestination(
  attendee: AttendeeState,
  timeSeconds: number,
  festival: Festival,
  settings: ResolvedSettings,
  destinations: readonly ResolvedDestination[],
  queues: Map<Id, VendorQueueState>,
  entrancePosition: Point,
  movement: RandomStream,
): void {
  const inventory = new Map(
    [...queues].map(([id, queue]) => [id, queue.inventoryRemaining]),
  );
  const walkingSpeed =
    settings.walkingSpeedMetersPerSecond * attendee.profile.walkingSpeedMultiplier;
  const selection = selectDestination(
    destinations,
    attendee.profile,
    settings.behavior,
    {
      completedStops: attendee.completedStops ?? 0,
      vendorStops: attendee.vendorStops,
      stageStops: attendee.stageStops,
      amenityStops: attendee.amenityStops,
      lastDestinationId: attendee.lastDestinationId,
      visitsByDestination: attendee.visitsByDestination,
      remainingBudget: attendee.remainingBudget ?? attendee.profile.initialBudget,
      position: attendee.position,
      timeSeconds,
      visitDeadlineSeconds: Math.min(
        settings.durationSeconds,
        attendee.spawnTimeSeconds + attendee.profile.visitDurationToleranceSeconds,
      ),
    },
    walkingSpeed,
    inventory,
    attendee.choice,
  );
  if (!selection.destination) {
    beginExit(
      attendee,
      selection.reason ?? "no_eligible_destination",
      festival,
      entrancePosition,
      movement,
    );
    return;
  }

  const destination = selection.destination;
  const roamingWaypoints =
    attendee.profile.intent === "explorer" && (attendee.completedStops ?? 0) === 0
      ? generateRoamingWaypoints(
          festival,
          settings.behavior.roamingWaypoints,
          attendee.choice,
        )
      : [];
  attendee.target = {
    destinationId: destination.id,
    destinationType: destination.type,
  };
  attendee.targetVendorId = destination.type === "vendor" ? destination.id : null;
  attendee.route = createTravelRoute(
    festival,
    attendee.position,
    destination.position,
    movement,
    roamingWaypoints,
  );
  attendee.routeIndex = 0;
  attendee.roamingWaypointCount = roamingWaypoints.length;
  if (attendee.status !== "entering") {
    attendee.status = roamingWaypoints.length > 0 ? "roaming" : "walking";
  }
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
      .map(
        ({
          id,
          position,
          status,
          targetVendorId,
          target,
          completedStops,
          remainingBudget,
          queueFrustration,
        }) => ({
          id,
          position: { ...position },
          status,
          targetVendorId,
          target: target ? { ...target } : null,
          completedStops: completedStops ?? 0,
          remainingBudget,
          ...(queueFrustration &&
          timeSeconds - queueFrustration.timeSeconds < 15
            ? { queueFrustration: { ...queueFrustration } }
            : {}),
        }),
      ),
    vendors: vendors.map((vendor) => {
      const queue = queues.get(vendor.id)!;
      return {
        vendorId: vendor.id,
        queueLength: queue.waiting.length,
        queueFull:
          vendor.queueLimit !== null &&
          queue.waiting.length >= vendor.queueLimit,
        inventoryRemaining: queue.inventoryRemaining,
        cumulativeSales: queue.cumulativeSales,
      };
    }),
  };
}

function processServiceCompletions(
  timeSeconds: number,
  festival: Festival,
  settings: ResolvedSettings,
  vendors: Vendor[],
  queues: Map<Id, VendorQueueState>,
  attendees: Map<Id, AttendeeState>,
  entrances: Map<Id, { position: Point }>,
  movement: RandomStream,
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
      attendee.remainingBudget =
        (attendee.remainingBudget ?? attendee.profile.initialBudget) - vendor.averagePrice;
      stepEvents.push({
        type: "purchase",
        timeSeconds,
        attendeeId: attendee.id,
        vendorId: vendor.id,
        amount: vendor.averagePrice,
        remainingBudget: attendee.remainingBudget,
        inventoryRemaining: queue.inventoryRemaining,
      });
      finishVisit(attendee, timeSeconds, false, stepEvents);
      const entrance = entrances.get(attendee.entranceId)!;
      afterCompletedStop(attendee, festival, settings, entrance.position, movement);
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
          finishVisit(attendee, timeSeconds, false, stepEvents);
          const entrance = entrances.get(attendee.entranceId)!;
          afterCompletedStop(attendee, festival, settings, entrance.position, movement);
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

/** Abandon this stall, record a modeled opportunity, then choose again within visit bounds. */
function recordMissedSale(
  attendee: AttendeeState,
  vendor: Vendor,
  reason: "wait_too_long" | "queue_full",
  timeSeconds: number,
  stepEvents: SimulationEvent[],
) {
  attendee.queueFrustration = {
    vendorId: vendor.id,
    reason,
    timeSeconds,
    missedSaleValue: vendor.averagePrice,
  };
  stepEvents.push({
    type: "missed_sale",
    attendeeId: attendee.id,
    ...attendee.queueFrustration,
  });
  attendee.status = "choosing";
  attendee.target = null;
  attendee.targetVendorId = null;
  attendee.route = [];
  attendee.routeIndex = 0;
  attendee.roamingWaypointCount = 0;
}

function processTimeouts(
  timeSeconds: number,
  festival: Festival,
  settings: ResolvedSettings,
  queues: Map<Id, VendorQueueState>,
  attendees: Map<Id, AttendeeState>,
  stepEvents: SimulationEvent[],
): void {
  for (const queue of [...queues.values()].sort((left, right) =>
    left.vendorId.localeCompare(right.vendorId),
  )) {
    for (const entry of [...queue.waiting]) {
      const attendee = attendees.get(entry.attendeeId);
      if (!attendee) throw new Error(`Unknown attendee: ${entry.attendeeId}`);
      const tolerance =
        attendee.profile.queueToleranceSeconds *
        settings.behavior.queueToleranceMultiplier;
      if (!hasQueueTimedOut(entry.joinedAtSeconds, timeSeconds, tolerance))
        continue;
      removeWaitingRequest(queue, entry.attendeeId);
      attendee.requestOpen = false;
      const waitedSeconds = timeSeconds - entry.joinedAtSeconds;
      stepEvents.push({
        type: "queue_abandon",
        timeSeconds,
        attendeeId: entry.attendeeId,
        vendorId: queue.vendorId,
        waitedSeconds,
      });
      finishVisit(attendee, timeSeconds, false, stepEvents);
      recordMissedSale(
        attendee,
        festival.vendors.find((v) => v.id === queue.vendorId)!,
        "wait_too_long",
        timeSeconds,
        stepEvents,
      );
    }
  }
}

function processDwellCompletions(
  timeSeconds: number,
  festival: Festival,
  settings: ResolvedSettings,
  attendees: Map<Id, AttendeeState>,
  entrances: Map<Id, { position: Point }>,
  movement: RandomStream,
  stepEvents: SimulationEvent[],
): void {
  for (const attendee of attendees.values()) {
    if (
      attendee.status !== "dwelling" ||
      attendee.activeVisit?.dwellCompletesAtSeconds === undefined ||
      attendee.activeVisit.dwellCompletesAtSeconds > timeSeconds + Number.EPSILON
    ) {
      continue;
    }
    const completedAtSeconds = attendee.activeVisit.dwellCompletesAtSeconds;
    finishVisit(attendee, completedAtSeconds, false, stepEvents);
    const entrance = entrances.get(attendee.entranceId)!;
    afterCompletedStop(attendee, festival, settings, entrance.position, movement);
  }
}

function moveAttendees(
  timeSeconds: number,
  festival: Festival,
  settings: SimulationSettings,
  destinations: ReadonlyMap<Id, ResolvedDestination>,
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
      attendee.status === "dwelling" ||
      attendee.status === "choosing" ||
      attendee.status === "exited" ||
      attendee.spawnTimeSeconds === timeSeconds
    ) {
      continue;
    }
    const targetPoint = attendee.route[attendee.routeIndex];
    if (!targetPoint) continue;
    if (attendee.status === "entering") {
      attendee.status = attendee.roamingWaypointCount > 0 ? "roaming" : "walking";
    }
    const movement = moveToward(
      attendee.position,
      targetPoint,
      settings.walkingSpeedMetersPerSecond *
        attendee.profile.walkingSpeedMultiplier *
        settings.stepSeconds,
    );
    attendee.position = clampToBounds(movement.position, festival);
    if (!movement.arrived) continue;

    if (attendee.routeIndex < attendee.route.length - 1) {
      attendee.routeIndex += 1;
      attendee.status =
        attendee.routeIndex < attendee.roamingWaypointCount
          ? "roaming"
          : attendee.status === "leaving"
            ? "leaving"
            : "walking";
      continue;
    }

    if (attendee.status === "leaving") {
      const entrance = entrances.get(attendee.entranceId);
      if (!entrance) throw new Error(`Unknown entrance: ${attendee.entranceId}`);
      exitAttendee(
        attendee,
        timeSeconds,
        attendee.exitReason ?? "no_eligible_destination",
        stepEvents,
        entrance.position,
      );
      continue;
    }

    const target = attendee.target;
    const destination = target ? destinations.get(target.destinationId) : undefined;
    if (!destination) {
      attendee.status = "choosing";
      attendee.target = null;
      attendee.targetVendorId = null;
      attendee.route = [];
      attendee.routeIndex = 0;
      continue;
    }
    startVisit(attendee, destination, timeSeconds, settings, stepEvents);
    if (destination.type === "vendor") {
      arrivals.push({ attendee, vendorId: destination.id });
    }
  }
  return arrivals;
}

function processArrivals(
  arrivals: VendorArrival[],
  timeSeconds: number,
  festival: Festival,
  settings: ResolvedSettings,
  queues: Map<Id, VendorQueueState>,
  entrances: Map<Id, { position: Point }>,
  movement: RandomStream,
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
    const effectiveTolerance =
      attendee.profile.queueToleranceSeconds *
      settings.behavior.queueToleranceMultiplier;
    const canStartWithoutWaiting =
      queue.active.length + queue.waiting.length < queue.serverCount &&
      hasServiceInventory(queue);
    if (effectiveTolerance === 0 && !canStartWithoutWaiting && queue.inventoryRemaining !== 0) {
      finishVisit(attendee, timeSeconds, false, stepEvents);
      recordMissedSale(
        attendee,
        festival.vendors.find((v) => v.id === vendorId)!,
        "wait_too_long",
        timeSeconds,
        stepEvents,
      );
      continue;
    }
    const admitted = admitRequest(queue, {
      attendeeId: attendee.id,
      joinedAtSeconds: timeSeconds,
    });
    if (!admitted) {
      finishVisit(attendee, timeSeconds, false, stepEvents);
      if (queue.inventoryRemaining !== 0)
        recordMissedSale(
          attendee,
          festival.vendors.find((v) => v.id === vendorId)!,
          "queue_full",
          timeSeconds,
          stepEvents,
        );
      else {
        const entrance = entrances.get(attendee.entranceId)!;
        afterCompletedStop(
          attendee,
          festival,
          settings,
          entrance.position,
          movement,
        );
      }
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

function terminateAtRunEnd(
  timeSeconds: number,
  attendees: Map<Id, AttendeeState>,
  queues: Map<Id, VendorQueueState>,
  entrances: Map<Id, { position: Point }>,
  stepEvents: SimulationEvent[],
): void {
  for (const attendee of [...attendees.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (attendee.status === "exited") continue;
    if (attendee.requestOpen) {
      for (const queue of queues.values()) {
        removeWaitingRequest(queue, attendee.id);
        if (queue.active.some((slot) => slot.attendeeId === attendee.id)) {
          releaseServiceSlot(queue, attendee.id);
        }
      }
      attendee.requestOpen = false;
    }
    finishVisit(attendee, timeSeconds, true, stepEvents);
    if (!entrances.has(attendee.entranceId)) {
      throw new Error(`Unknown entrance: ${attendee.entranceId}`);
    }
    exitAttendee(attendee, timeSeconds, "run_ended", stepEvents);
  }
}

export const runSimulation: RunSimulation = (festival, settings) => {
  validateSettings(settings);
  const resolvedSettings: ResolvedSettings = {
    ...settings,
    behavior: resolveBehaviorSettings(settings.behavior),
  };
  const streams = createNamedRandomStreams(settings.seed);
  const attendeeProfiles = createAttendeeProfiles(
    festival,
    resolvedSettings,
    streams,
  ).map((profile) => ({
    ...profile,
    intent: assignStableIntent(
      settings.seed,
      profile.choiceStreamKey,
      resolvedSettings.behavior.intentWeights,
    ),
  }));
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
  const destinations = resolveDestinations(festival, resolvedSettings.behavior);
  const destinationsById = new Map(
    destinations.map((destination) => [destination.id, destination]),
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
      attendees.set(profile.id, {
        id: profile.id,
        entranceId: entrance.id,
        spawnTimeSeconds: timeSeconds,
        profile,
        choice: createAttendeeChoiceStream(
          settings.seed,
          profile.choiceStreamKey,
        ),
        position: clampToBounds(entrance.position, festival),
        status: "entering",
        targetVendorId: null,
        target: null,
        completedStops: 0,
        remainingBudget: profile.initialBudget,
        route: [],
        routeIndex: 0,
        roamingWaypointCount: 0,
        requestOpen: false,
        visitsByDestination: new Map(),
        vendorStops: 0,
        stageStops: 0,
        amenityStops: 0,
        lastDestinationId: null,
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
        festival,
        resolvedSettings,
        vendors,
        queues,
        attendees,
        entrances,
        streams.movement,
        stepEvents,
      );
      processTimeouts(
        timeSeconds,
        festival,
        resolvedSettings,
        queues,
        attendees,
        stepEvents,
      );
      processDwellCompletions(
        timeSeconds,
        festival,
        resolvedSettings,
        attendees,
        entrances,
        streams.movement,
        stepEvents,
      );
      const arrivals = moveAttendees(
        timeSeconds,
        festival,
        settings,
        destinationsById,
        attendees,
        entrances,
        stepEvents,
      );
      processDwellCompletions(
        timeSeconds,
        festival,
        resolvedSettings,
        attendees,
        entrances,
        streams.movement,
        stepEvents,
      );
      processArrivals(
        arrivals,
        timeSeconds,
        festival,
        resolvedSettings,
        queues,
        entrances,
        streams.movement,
        stepEvents,
      );
      startServices(
        timeSeconds,
        settings,
        vendors,
        queues,
        attendees,
        streams.service,
        stepEvents,
      );
      processTimeouts(
        timeSeconds,
        festival,
        resolvedSettings,
        queues,
        attendees,
        stepEvents,
      );
    }

    if (stepIndex < totalSteps) {
      for (const attendee of [...attendees.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      )) {
        if (attendee.status !== "choosing" && attendee.status !== "entering")
          continue;
        if (
          attendee.status === "entering" &&
          attendee.spawnTimeSeconds === timeSeconds
        ) {
          continue;
        }
        if (attendee.route.length > 0) continue;
        const entrance = entrances.get(attendee.entranceId)!;
        planDestination(
          attendee,
          timeSeconds,
          festival,
          resolvedSettings,
          destinations,
          queues,
          entrance.position,
          streams.movement,
        );
      }
    } else {
      terminateAtRunEnd(timeSeconds, attendees, queues, entrances, stepEvents);
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
    settings: resolvedSettings,
    attendeeProfiles,
    frames: withBusinessSnapshots(events, frames, vendors),
    events,
    destinationMetrics: [],
    destinationTransitions: [],
    ...aggregates,
  };
};
