import type { SimulationSettings } from "../../domain";
import { festivalDemoSettings } from "./vendorDemo";

/** Randomize only the UI's run input; the engine and paired comparisons stay seeded. */
export function freshDemoSettings(
  previousSeed?: number,
  draw: () => number = () => crypto.getRandomValues(new Int32Array(1))[0],
): SimulationSettings {
  const sampled = draw() | 0;
  const seed = sampled === previousSeed ? (sampled + 1) | 0 : sampled;
  return { ...structuredClone(festivalDemoSettings), seed };
}
