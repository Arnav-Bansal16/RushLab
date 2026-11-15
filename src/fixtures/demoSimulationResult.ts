import {
  CURRENT_SIMULATION_MODEL_SEMANTICS,
  type SimulationResult,
} from "../domain";
import { demoFestival } from "./demoFestival";

/**
 * A small, internally consistent result for playback and dashboard integration.
 * It is illustrative modeled output, not a forecast or a performance baseline.
 */
export const demoSimulationResult = {
  schemaVersion: 1,
  festivalId: "festival-demo",
  festival: demoFestival,
  modelSemantics: { ...CURRENT_SIMULATION_MODEL_SEMANTICS },
  settings: {
    seed: 20261113,
    attendeeCount: 1,
    durationSeconds: 180,
    stepSeconds: 0.5,
    frameIntervalSeconds: 1,
    walkingSpeedMetersPerSecond: 1.4,
    behavior: {
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
    },
  },
  attendeeProfiles: [
    {
      id: "attendee-001",
      choiceStreamKey: "choice:attendee-001",
      entranceId: "entrance-main",
      spawnTimeSeconds: 0,
      intent: "vendor_first",
      destinationTypeWeights: {
        stage: 1,
        vendor: 0.85,
        restroom: 0.25,
        seating: 0.18,
        first_aid: 0.02,
      },
      vendorCategoryWeights: {
        food: 0.8,
        drink: 0.5,
        merchandise: 0.2,
        activity: 0.3,
        other: 0.1,
      },
      priceSensitivity: 0.4,
      queueToleranceSeconds: 120,
      walkingSpeedMultiplier: 1,
      stageAttractionPreference: 0.9,
      explorationTendency: 0.1,
      amenityTendency: 0.2,
      dwellDurationTendency: 1,
      exitTendency: 0.15,
      visitDurationToleranceSeconds: 1800,
      initialBudget: 30,
    },
  ],
  frames: [
    {
      timeSeconds: 0,
      attendees: [
        {
          id: "attendee-001",
          position: { x: 8, y: 40 },
          status: "entering",
          targetVendorId: "vendor-tacos",
        },
      ],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 0,
          inventoryRemaining: 180,
          cumulativeSales: 0,
        },
      ],
    },
    {
      timeSeconds: 45,
      attendees: [
        {
          id: "attendee-001",
          position: { x: 42, y: 28 },
          status: "queued",
          targetVendorId: "vendor-tacos",
        },
      ],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 1,
          inventoryRemaining: 180,
          cumulativeSales: 0,
        },
      ],
    },
    {
      timeSeconds: 60,
      attendees: [
        {
          id: "attendee-001",
          position: { x: 42, y: 28 },
          status: "purchasing",
          targetVendorId: "vendor-tacos",
        },
      ],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 0,
          inventoryRemaining: 180,
          cumulativeSales: 0,
        },
      ],
    },
    {
      timeSeconds: 135,
      attendees: [
        {
          id: "attendee-001",
          position: { x: 42, y: 28 },
          status: "leaving",
          targetVendorId: null,
        },
      ],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 0,
          inventoryRemaining: 179,
          cumulativeSales: 1,
        },
      ],
    },
    {
      timeSeconds: 160,
      attendees: [
        {
          id: "attendee-001",
          position: { x: 8, y: 40 },
          status: "exited",
          targetVendorId: null,
        },
      ],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 0,
          inventoryRemaining: 179,
          cumulativeSales: 1,
        },
      ],
    },
  ],
  events: [
    {
      type: "spawn",
      timeSeconds: 0,
      attendeeId: "attendee-001",
      entranceId: "entrance-main",
    },
    {
      type: "queue_join",
      timeSeconds: 45,
      attendeeId: "attendee-001",
      vendorId: "vendor-tacos",
    },
    {
      type: "service_start",
      timeSeconds: 60,
      attendeeId: "attendee-001",
      vendorId: "vendor-tacos",
    },
    {
      type: "purchase",
      timeSeconds: 135,
      attendeeId: "attendee-001",
      vendorId: "vendor-tacos",
      amount: 12,
    },
    { type: "exit", timeSeconds: 160, attendeeId: "attendee-001" },
  ],
  vendorMetrics: [
    {
      vendorId: "vendor-tacos",
      visits: 1,
      queueJoins: 1,
      purchases: 1,
      abandonments: 0,
      revenue: 12,
      averageWaitSeconds: 15,
      maximumQueueLength: 1,
      utilization: 75 / (180 * 2),
      stockoutTimeSeconds: null,
    },
  ],
  destinationMetrics: [],
  destinationTransitions: [],
  totals: {
    purchases: 1,
    revenue: 12,
    abandonments: 0,
    exitedAttendees: 1,
  },
} satisfies SimulationResult;
