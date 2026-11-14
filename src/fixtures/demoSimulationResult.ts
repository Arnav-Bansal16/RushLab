import type { SimulationResult } from "../domain";

/**
 * A small, internally consistent result for playback and dashboard integration.
 * It is illustrative modeled output, not a forecast or a performance baseline.
 */
export const demoSimulationResult = {
  schemaVersion: 1,
  festivalId: "festival-demo",
  settings: {
    seed: 20261113,
    attendeeCount: 1,
    durationSeconds: 180,
    stepSeconds: 0.5,
    frameIntervalSeconds: 1,
    walkingSpeedMetersPerSecond: 1.4,
  },
  attendeeProfiles: [
    {
      id: "attendee-001",
      entranceId: "entrance-main",
      spawnTimeSeconds: 0,
      budget: 30,
      categoryWeights: {
        food: 0.8,
        drink: 0.5,
        merchandise: 0.2,
        activity: 0.3,
        other: 0.1,
      },
      priceSensitivity: 0.4,
      queueToleranceSeconds: 120,
      exploration: 0.1,
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
  totals: {
    purchases: 1,
    revenue: 12,
    abandonments: 0,
    exitedAttendees: 1,
  },
} satisfies SimulationResult;
