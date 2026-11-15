import { expect, it } from "vitest";
import { freshDemoSettings } from "./demoSeed";
import { festivalDemoSettings } from "./vendorDemo";
import { executeRun } from "./run";
import { createFestivalDemo } from "./vendorDemo";
it("takes fresh random seeds at the UI boundary and avoids immediate repeats", () => {
  expect(freshDemoSettings(undefined, () => 17).seed).toBe(17);
  expect(freshDemoSettings(17, () => 17).seed).toBe(18);
  expect(freshDemoSettings(2147483647, () => 2147483647).seed).toBe(
    -2147483648,
  );
  const settings = freshDemoSettings(undefined, () => 71);
  expect(settings.behavior).toEqual(festivalDemoSettings.behavior);
  settings.behavior!.queueToleranceMultiplier = 0;
  expect(festivalDemoSettings.behavior!.queueToleranceMultiplier).toBe(1);
});
it("different demo seeds vary real runs; replaying a saved seed remains deterministic", () => {
  const layout = createFestivalDemo();
  const first = {
    ...freshDemoSettings(undefined, () => 71),
    attendeeCount: 30,
    durationSeconds: 120,
  };
  const second = {
    ...freshDemoSettings(71, () => 72),
    attendeeCount: 30,
    durationSeconds: 120,
  };
  const a = executeRun(layout, first),
    b = executeRun(layout, second),
    replay = executeRun(layout, first);
  if (!a.ok || !b.ok || !replay.ok)
    throw new Error("Expected successful demo runs");
  expect(a.run.result.attendeeProfiles).not.toEqual(
    b.run.result.attendeeProfiles,
  );
  expect(a.run.result.events).not.toEqual(b.run.result.events);
  expect(a.run.result).toEqual(replay.run.result);
  expect(a.run.result.settings.seed).toBe(71);
  expect(b.run.result.settings.seed).toBe(72);
});
