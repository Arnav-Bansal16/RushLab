import { expect, it } from "vitest";
import { createFestivalDemo, festivalDemoSettings } from "./vendorDemo";
import { executeRun } from "./run";
import { attendeeStyle, betweenStopsStyle, statusStyles } from "./presentation";
it("keeps the demo busy inside the festival, with real waiting and a canonical bathroom/exit", () => {
  const layout = createFestivalDemo();
  expect(festivalDemoSettings.durationSeconds).toBe(600);
  expect(
    layout.amenities!.some(
      (a) => a.type === "restroom" && a.name === "Bathroom",
    ),
  ).toBe(true);
  expect(layout.entrances).toHaveLength(1);
  expect(layout.entrances[0].name).toContain("EXIT");
  const first = executeRun(layout, festivalDemoSettings);
  if (!first.ok) throw new Error(first.errors.join(" "));
  expect(executeRun(layout, festivalDemoSettings)).toEqual(first);
  expect(first.run.result.events.some((e) => e.type === "queue_join")).toBe(
    true,
  );
  expect(
    first.run.result.frames.some((f) =>
      f.vendors.some((v) => v.queueLength > 0),
    ),
  ).toBe(true);
  const spawned = first.run.result.attendeeProfiles.filter(
    (p) => p.spawnTimeSeconds <= 150,
  ).length;
  const exited = first.run.result.events.filter(
    (e) => e.type === "exit" && e.timeSeconds < 150,
  ).length;
  expect(exited / spawned).toBeLessThan(0.1);
  const frame = first.run.result.frames.find((f) => f.timeSeconds === 150)!;
  for (const a of frame.attendees) {
    expect(attendeeStyle(a)).toEqual(
      a.status === "walking" && (a.completedStops ?? 0) > 0
        ? betweenStopsStyle
        : statusStyles[a.status],
    );
  }
});
