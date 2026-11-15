import { describe, expect, it } from "vitest";
import { runSimulation } from ".";
import {
  createFestivalDemo,
  festivalDemoSettings,
} from "../features/playback/vendorDemo";
import { snapshotFestival } from "../features/editor/simulationInput";
import { compareScenarios } from "../analytics/comparison";
import { resolveBehaviorSettings } from "../domain";

describe("opt-in event-end retention", () => {
  it("retains everyone and engine-recorded frustration until closing without inventing visits or sales", () => {
    const festival = snapshotFestival(createFestivalDemo());
    const settings = structuredClone(festivalDemoSettings);
    const original = JSON.stringify({ festival, settings });
    const result = runSimulation(festival, settings);
    const exits = result.events.filter((event) => event.type === "exit");
    expect(exits).toHaveLength(settings.attendeeCount);
    expect(
      exits.every(
        (event) =>
          event.timeSeconds === settings.durationSeconds &&
          event.reason === "run_ended",
      ),
    ).toBe(true);
    const frame = result.frames.at(-2)!;
    expect(
      frame.attendees.every(
        (person) => person.status !== "exited" && person.status !== "leaving",
      ),
    ).toBe(true);
    const frustrated = new Set(
      result.events
        .filter(
          (event) =>
            event.type === "missed_sale" &&
            event.timeSeconds <= frame.timeSeconds,
        )
        .flatMap((event) => event.type === "missed_sale" ? [event.attendeeId] : []),
    );
    expect(frustrated.size).toBeGreaterThan(100);
    expect(
      new Set(
        frame.attendees
          .filter((person) => person.queueFrustration)
          .map((person) => person.id),
      ),
    ).toEqual(frustrated);
    expect(
      frame.attendees.some(
        (person) => person.stayingUntilEnd && person.queueFrustration,
      ),
    ).toBe(true);
    expect(
      frame.attendees
        .filter((person) => person.stayingUntilEnd)
        .every(
          (person) => person.status === "dwelling" && person.target === null,
        ),
    ).toBe(true);
    expect(
      result.frames
        .at(-1)!
        .attendees.every(
          (person) =>
            person.status === "exited" &&
            !person.queueFrustration &&
            !person.stayingUntilEnd,
        ),
    ).toBe(true);
    expect(
      result.frames.at(-1)!.vendors.every((vendor) => vendor.queueLength === 0),
    ).toBe(true);
    const purchases = result.events.filter(
      (event) => event.type === "purchase",
    );
    expect(result.totals.purchases).toBe(purchases.length);
    expect(result.totals.revenue).toBe(
      purchases.reduce((sum, event) => sum + event.amount, 0),
    );
    expect(
      result.frames
        .flatMap((frame) => frame.attendees)
        .every(
          (person) =>
            (person.completedStops ?? 0) <= 6 &&
            (person.remainingBudget ?? 0) >= 0,
        ),
    ).toBe(true);
    expect(JSON.stringify({ festival, settings })).toBe(original);
  });
  it("is deterministic and rejects comparison with normal-departure assumptions", () => {
    const festival = snapshotFestival(createFestivalDemo());
    const settings = {
      ...festivalDemoSettings,
      attendeeCount: 30,
      durationSeconds: 120,
    };
    const retained = runSimulation(festival, settings);
    expect(runSimulation(festival, settings)).toEqual(retained);
    const normal = runSimulation(festival, {
      ...settings,
      behavior: { ...settings.behavior, retainAttendeesUntilEnd: false },
    });
    expect(compareScenarios(retained, normal).compatibility.status).toBe(
      "incompatible",
    );
    expect(retained.attendeeProfiles).toEqual(normal.attendeeProfiles);
    for (const frame of normal.frames)
      for (const person of frame.attendees)
        if (person.queueFrustration)
          expect(
            frame.timeSeconds - person.queueFrustration.timeSeconds,
          ).toBeLessThan(15);
    expect(resolveBehaviorSettings(undefined).retainAttendeesUntilEnd).toBe(
      false,
    );
    expect(() =>
      resolveBehaviorSettings({
        retainAttendeesUntilEnd: "yes" as unknown as boolean,
      }),
    ).toThrow("must be boolean");
  });
});
