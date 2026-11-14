import { describe, expect, it } from "vitest";
import type { SimulationSettings } from "../domain";
import { demoFestival } from "../fixtures/demoFestival";
import {
  createAttendeeProfiles,
  createNamedRandomStreams,
  runSimulation,
} from ".";

const settings: SimulationSettings = {
  seed: 20261114,
  attendeeCount: 250,
  durationSeconds: 180,
  stepSeconds: 0.5,
  frameIntervalSeconds: 1,
  walkingSpeedMetersPerSecond: 1.4,
};

describe("runSimulation", () => {
  it("returns identical results for identical inputs and seeds", () => {
    expect(runSimulation(demoFestival, settings)).toEqual(
      runSimulation(demoFestival, settings),
    );
  });

  it("returns different profiles and results for different seeds", () => {
    const first = runSimulation(demoFestival, settings);
    const second = runSimulation(demoFestival, { ...settings, seed: 42 });

    expect(second.attendeeProfiles).not.toEqual(first.attendeeProfiles);
    expect(second).not.toEqual(first);
  });

  it("keeps named streams independent", () => {
    const untouched = createNamedRandomStreams(settings.seed);
    const movementConsumed = createNamedRandomStreams(settings.seed);
    for (let draw = 0; draw < 1_000; draw += 1) {
      movementConsumed.movement.float();
    }

    expect(
      createAttendeeProfiles(demoFestival, settings, movementConsumed),
    ).toEqual(createAttendeeProfiles(demoFestival, settings, untouched));
    expect(movementConsumed.service.float()).toBe(untouched.service.float());
    expect(movementConsumed.choice.float()).toBe(untouched.choice.float());
  });

  it("records monotonic fixed-step time and in-bounds positions", () => {
    const result = runSimulation(demoFestival, settings);
    const frameTimes = result.frames.map(({ timeSeconds }) => timeSeconds);
    const eventTimes = result.events.map(({ timeSeconds }) => timeSeconds);

    expect(result.attendeeProfiles).toHaveLength(250);
    expect(frameTimes[0]).toBe(0);
    expect(
      frameTimes.every(
        (time, index) => index === 0 || time > frameTimes[index - 1]!,
      ),
    ).toBe(true);
    expect(
      eventTimes.every(
        (time, index) => index === 0 || time >= eventTimes[index - 1]!,
      ),
    ).toBe(true);
    for (const frame of result.frames) {
      expect(frame.timeSeconds / settings.stepSeconds).toBeCloseTo(
        Math.round(frame.timeSeconds / settings.stepSeconds),
      );
      for (const attendee of frame.attendees) {
        expect(attendee.position.x).toBeGreaterThanOrEqual(0);
        expect(attendee.position.x).toBeLessThanOrEqual(
          demoFestival.boundsMeters.width,
        );
        expect(attendee.position.y).toBeGreaterThanOrEqual(0);
        expect(attendee.position.y).toBeLessThanOrEqual(
          demoFestival.boundsMeters.height,
        );
      }
    }
  });
});
