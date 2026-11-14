import { describe, expect, it } from "vitest";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import { frameCursor, initialPlayback, playbackReducer } from "./controller";

const frames = demoSimulationResult.frames;
describe("frame playback controller", () => {
  it("handles no frames and a single nonzero-time frame without a running cursor", () => {
    expect(frameCursor([], 100)).toBe(-1);
    expect(playbackReducer([], initialPlayback([]), { type: "play" })).toEqual({
      timeSeconds: 0,
      playing: false,
      speed: 1,
    });
    const single = [{ ...frames[0], timeSeconds: 17 }];
    let state = playbackReducer(single, initialPlayback(single), {
      type: "play",
    });
    expect(state.playing).toBe(false);
    expect(state.timeSeconds).toBe(17);
    state = playbackReducer(single, state, { type: "scrub", timeSeconds: 999 });
    expect(frameCursor(single, state.timeSeconds)).toBe(0);
    expect(state.timeSeconds).toBe(17);
  });
  it("selects the first, sparse interior, and last frames without assuming duration", () => {
    expect(frameCursor(frames, -100)).toBe(0);
    expect(frameCursor(frames, 59)).toBe(1);
    expect(frameCursor(frames, 60)).toBe(2);
    expect(frameCursor(frames, Infinity)).toBe(0);
    expect(frameCursor(frames, 180)).toBe(frames.length - 1);
    expect(frames.at(-1)?.timeSeconds).not.toBe(
      demoSimulationResult.settings.durationSeconds,
    );
  });
  it("plays, pauses, resumes, changes speed, scrubs, restarts, and replays", () => {
    let state = initialPlayback(frames);
    state = playbackReducer(frames, state, { type: "play" });
    state = playbackReducer(frames, state, {
      type: "advance",
      elapsedSeconds: 10,
    });
    expect(state.timeSeconds).toBe(10);
    state = playbackReducer(frames, state, { type: "pause" });
    expect(
      playbackReducer(frames, state, { type: "advance", elapsedSeconds: 100 }),
    ).toBe(state);
    state = playbackReducer(frames, state, { type: "speed", speed: 2 });
    state = playbackReducer(frames, state, { type: "play" });
    state = playbackReducer(frames, state, {
      type: "advance",
      elapsedSeconds: 5,
    });
    expect(state.timeSeconds).toBe(20);
    state = playbackReducer(frames, state, { type: "scrub", timeSeconds: 60 });
    expect(state.playing).toBe(false);
    expect(state.timeSeconds).toBe(60);
    state = playbackReducer(frames, state, { type: "restart" });
    expect(state.timeSeconds).toBe(0);
    expect(state.speed).toBe(2);
    expect(state.playing).toBe(false);
    state = playbackReducer(frames, state, { type: "play" });
    state = playbackReducer(frames, state, {
      type: "advance",
      elapsedSeconds: 1000,
    });
    expect(state.timeSeconds).toBe(160);
    expect(state.playing).toBe(false);
    state = playbackReducer(frames, state, { type: "play" });
    expect(state.timeSeconds).toBe(0);
    expect(state.playing).toBe(true);
  });
  it("never overflows after repeated scrubs and large presentation advances", () => {
    const original = structuredClone(frames);
    let state = initialPlayback(frames);
    for (let i = 0; i < 1000; i++) {
      state = playbackReducer(frames, state, {
        type: "scrub",
        timeSeconds: i % 2 === 0 ? -i : i * 100,
      });
      state = playbackReducer(frames, state, { type: "play" });
      state = playbackReducer(frames, state, {
        type: "advance",
        elapsedSeconds: i,
      });
      const index = frameCursor(frames, state.timeSeconds);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(frames.length);
    }
    state = playbackReducer(frames, state, { type: "restart" });
    state = playbackReducer(frames, state, { type: "play" });
    state = playbackReducer(frames, state, {
      type: "advance",
      elapsedSeconds: Number.MAX_VALUE,
    });
    expect(state.timeSeconds).toBe(160);
    expect(frames).toEqual(original);
    expect(playbackReducer(frames, state, { type: "speed", speed: NaN })).toBe(
      state,
    );
    expect(
      playbackReducer(frames, state, { type: "advance", elapsedSeconds: -1 }),
    ).toBe(state);
  });
});
