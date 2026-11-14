import type {
  Festival,
  SimulationSettings,
  VendorCategory,
} from "../../domain";
import { fromFestival } from "../editor/layout";

/** Planning example only; all attendee movement is produced by the real public engine. */
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
    obstacles: [],
    vendors: stalls.map((stall, index) => ({
      id: `market-vendor-${index + 1}`,
      name: stall.name,
      category: stall.category,
      position: { x: 30 + (index % 4) * 28, y: index < 4 ? 26 : 70 },
      size: { width: 8, height: 6 },
      popularity: 0.7,
      averagePrice: 12,
      serviceTimeSeconds: 45,
      servers: 2,
      inventory: null,
      queueLimit: null,
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
