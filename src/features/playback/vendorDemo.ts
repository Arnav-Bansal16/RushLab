import type {
  Festival,
  SimulationSettings,
  VendorCategory,
} from "../../domain";
import { fromFestival } from "../editor/layout";

/** Illustrative planning inputs; all movement, queues and commerce come from the public engine. */
export function createVendorDemo() {
  const stalls: { name: string; category: VendorCategory }[] = [
    { name: "Taco Kitchen", category: "food" },
    { name: "Pizza Oven", category: "food" },
    { name: "Coffee Corner", category: "drink" },
    { name: "Fresh Juices", category: "drink" },
    { name: "Burger Grill", category: "food" },
    { name: "Ice Cream", category: "food" },
    { name: "Event Merchandise", category: "merchandise" },
    { name: "Games Tent", category: "activity" },
  ];
  const festival: Festival = {
    schemaVersion: 1,
    id: "multi-vendor-example",
    name: "Riverside Market · 8-vendor example",
    boundsMeters: { width: 160, height: 100 },
    entrances: [
      {
        id: "gate-west",
        name: "West entrance",
        position: { x: 8, y: 50 },
        spawnWeight: 1,
      },
      {
        id: "gate-south",
        name: "South entrance",
        position: { x: 80, y: 92 },
        spawnWeight: 1,
      },
    ],
    stages: [
      {
        id: "stage-music",
        name: "Live music",
        position: { x: 132, y: 38 },
        size: { width: 20, height: 22 },
        attraction: 0.8,
      },
    ],
    paths: [
      {
        id: "market-walk",
        points: [
          { x: 8, y: 50 },
          { x: 142, y: 50 },
        ],
        widthMeters: 8,
      },
    ],
    amenities: [
      {
        id: "market-seating",
        name: "Garden seating",
        type: "seating",
        position: { x: 42, y: 8 },
        size: { width: 12, height: 8 },
        attraction: 0.5,
      },
      {
        id: "market-restroom",
        name: "Restrooms",
        type: "restroom",
        position: { x: 76, y: 8 },
        size: { width: 8, height: 6 },
        attraction: 0.5,
      },
      {
        id: "market-first-aid",
        name: "First aid",
        type: "first_aid",
        position: { x: 110, y: 8 },
        size: { width: 8, height: 6 },
        attraction: 0.5,
      },
    ],
    obstacles: [],
    vendors: stalls.map((stall, index) => ({
      id: `market-vendor-${index + 1}`,
      name: stall.name,
      category: stall.category,
      position: { x: 30 + (index % 4) * 28, y: index < 4 ? 26 : 70 },
      size: { width: 8, height: 6 },
      popularity: 0.7,
      averagePrice: 12,
      serviceTimeSeconds: [8, 18, 6, 12, 20, 10, 30, 25][index],
      servers: [1, 2, 2, 2, 1, 1, 1, 2][index],
      inventory: [3, 12, null, 18, 15, 8, 10, null][index],
      queueLimit: [12, 20, 16, 18, 18, 12, 12, 16][index],
    })),
  };
  return fromFestival(festival);
}
export const vendorDemoSettings: SimulationSettings = {
  seed: 42,
  attendeeCount: 300,
  durationSeconds: 180,
  stepSeconds: 0.5,
  frameIntervalSeconds: 1,
  walkingSpeedMetersPerSecond: 1.4,
};

/** A visitor-retention demo, separate from the stockout regression example above. */
export function createFestivalDemo() {
  const layout = createVendorDemo();
  layout.name = "Riverside Festival · stay and explore";
  layout.entrances = [
    {
      ...layout.entrances[0],
      name: "Main entrance / EXIT",
      position: { x: 8, y: 50 },
    },
  ];
  layout.amenities!.find((item) => item.type === "restroom")!.name = "Bathroom";
  layout.vendors = layout.vendors.map((vendor, index) => ({
    ...vendor,
    averagePrice: [5, 7, 3, 4, 8, 3, 10, 5][index],
    serviceTimeSeconds: 30,
    servers: 1,
    inventory: null,
    queueLimit: null,
  }));
  return layout;
}
export const festivalDemoSettings: SimulationSettings = {
  ...vendorDemoSettings,
  behavior: {
    maximumItineraryStops: 6,
    maximumVendorStops: 6,
    maximumStageStops: 6,
    maximumAmenityStops: 6,
    maximumVisitsPerDestination: 2,
    deterministicExitProbabilityAfterStop: 0,
    minimumRemainingTimeSeconds: 0,
    queueToleranceMultiplier: 5,
    dwellDurationSeconds: {
      stage: { minimum: 90, maximum: 180 },
      seating: { minimum: 90, maximum: 180 },
      restroom: { minimum: 30, maximum: 60 },
      first_aid: { minimum: 60, maximum: 120 },
    },
  },
};
