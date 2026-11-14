import { describe, expect, it } from "vitest";
import type { SimulationEvent, SimulationSettings } from "../domain";
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

  it("keeps newly spawned attendees at their entrance for the spawn tick", () => {
    const result = runSimulation(demoFestival, settings);
    let checkedSpawnFrames = 0;

    for (const event of result.events) {
      if (event.type !== "spawn") continue;
      const frame = result.frames.find(
        ({ timeSeconds }) => timeSeconds === event.timeSeconds,
      );
      const attendee = frame?.attendees.find(
        ({ id }) => id === event.attendeeId,
      );
      if (!attendee) continue;
      const entrance = demoFestival.entrances.find(
        ({ id }) => id === event.entranceId,
      );

      expect(attendee.position).toEqual(entrance?.position);
      expect(attendee.status).toBe("entering");
      checkedSpawnFrames += 1;
    }

    expect(checkedSpawnFrames).toBeGreaterThan(0);
  });

  it.each([0, 1, 42, 20261114, -17])(
    "preserves event and frame invariants for seed %i",
    (seed) => {
      const result = runSimulation(demoFestival, {
        ...settings,
        seed,
        attendeeCount: 40,
      });
      const spawnEvents = result.events.filter(
        (event): event is Extract<SimulationEvent, { type: "spawn" }> =>
          event.type === "spawn",
      );
      const exitEvents = result.events.filter(({ type }) => type === "exit");

      expect(spawnEvents).toHaveLength(40);
      expect(
        new Set(spawnEvents.map(({ attendeeId }) => attendeeId)).size,
      ).toBe(40);
      expect(result.totals.exitedAttendees).toBe(exitEvents.length);
      expect(
        result.events.every(
          (event, index) =>
            index === 0 ||
            event.timeSeconds >= result.events[index - 1]!.timeSeconds,
        ),
      ).toBe(true);
      expect(
        result.frames
          .flatMap(({ attendees }) => attendees)
          .every(
            ({ position }) =>
              position.x >= 0 &&
              position.x <= demoFestival.boundsMeters.width &&
              position.y >= 0 &&
              position.y <= demoFestival.boundsMeters.height,
          ),
      ).toBe(true);
    },
  );
});
