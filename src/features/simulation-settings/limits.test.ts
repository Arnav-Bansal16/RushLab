import { expect, it, vi } from "vitest";
import { DEFAULT_BEHAVIOR_SETTINGS, type RunSimulation } from "../../domain";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import { executeRun } from "../playback/run";
import { createVendorDemo, vendorDemoSettings } from "../playback/vendorDemo";
import { behaviorFields, readBehavior } from "./BehaviorControls";

const invalidLimits: Record<string, number[]> = {
  maximumItineraryStops: [0, 7, 1.5],
  maximumVendorStops: [5, 0.5],
  maximumStageStops: [5, 0.5],
  maximumAmenityStops: [5, 0.5],
  maximumVisitsPerDestination: [0, 5, 1.5],
  roamingWaypoints: [3, 0.5],
  queueToleranceMultiplier: [5.01],
  priceElasticity: [10.01],
  deterministicExitProbabilityAfterStop: [1.01],
  minimumRemainingTimeSeconds: [3601],
};
it.each(behaviorFields().map((field) => [field.path]))(
  "rejects nonfinite, empty and out-of-range %s before execution",
  (path) => {
    const maximum = path.includes("Weights")
      ? [10.01]
      : path.includes("dwellDurationSeconds")
        ? [3601]
        : invalidLimits[path];
    for (const raw of [
      "",
      "bad",
      "NaN",
      "Infinity",
      "-1",
      ...maximum.map(String),
    ]) {
      const data = new FormData();
      for (const field of behaviorFields())
        data.set(`behavior.${field.path}`, String(field.value));
      data.set(`behavior.${path}`, raw);
      const engine = vi.fn<RunSimulation>(() => demoSimulationResult);
      expect(
        executeRun(
          createVendorDemo(),
          { ...vendorDemoSettings, behavior: readBehavior(data) },
          engine,
        ).ok,
        `${path} = ${raw}`,
      ).toBe(false);
      expect(engine).not.toHaveBeenCalled();
    }
  },
);
it("does not mutate nested shared defaults during validation", () => {
  const before = structuredClone(DEFAULT_BEHAVIOR_SETTINGS);
  const input = structuredClone(DEFAULT_BEHAVIOR_SETTINGS);
  input.dwellDurationSeconds.stage.minimum = 121;
  expect(
    executeRun(createVendorDemo(), { ...vendorDemoSettings, behavior: input })
      .ok,
  ).toBe(false);
  expect(DEFAULT_BEHAVIOR_SETTINGS).toEqual(before);
});
