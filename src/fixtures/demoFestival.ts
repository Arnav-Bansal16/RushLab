import type { Festival } from "../domain";

export const demoFestival = {
  schemaVersion: 1,
  id: "festival-demo",
  name: "RushLab Demo Festival",
  boundsMeters: { width: 120, height: 80 },
  entrances: [
    {
      id: "entrance-main",
      name: "Main Gate",
      position: { x: 8, y: 40 },
      spawnWeight: 1,
    },
  ],
  stages: [
    {
      id: "stage-main",
      name: "Main Stage",
      position: { x: 96, y: 28 },
      size: { width: 18, height: 24 },
      attraction: 0.9,
    },
  ],
  paths: [
    {
      id: "path-main",
      points: [
        { x: 8, y: 40 },
        { x: 105, y: 40 },
      ],
      widthMeters: 8,
    },
  ],
  obstacles: [],
  vendors: [
    {
      id: "vendor-tacos",
      name: "Taco Stand",
      category: "food",
      position: { x: 42, y: 28 },
      size: { width: 6, height: 4 },
      popularity: 0.72,
      averagePrice: 12,
      serviceTimeSeconds: 75,
      servers: 2,
      inventory: 180,
      queueLimit: 30,
    },
  ],
} satisfies Festival;
