import type { SimulationFrame } from "../../domain";

export interface PlaybackState {
  timeSeconds: number;
  playing: boolean;
  speed: number;
}
export type PlaybackAction =
  | { type: "play" | "pause" | "restart" }
  | { type: "scrub"; timeSeconds: number }
  | { type: "speed"; speed: number }
  | { type: "advance"; elapsedSeconds: number };
export function initialPlayback(
  frames: readonly SimulationFrame[],
): PlaybackState {
  return { timeSeconds: frames[0]?.timeSeconds ?? 0, playing: false, speed: 1 };
}
/** Index of the latest recorded snapshot at or before the presentation cursor. */
export function frameCursor(
  frames: readonly SimulationFrame[],
  timeSeconds: number,
): number {
  if (!frames.length) return -1;
  const time = Number.isFinite(timeSeconds)
    ? timeSeconds
    : frames[0].timeSeconds;
  let low = 0,
    high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle].timeSeconds <= time) low = middle;
    else high = middle - 1;
  }
  return low;
}
export function playbackReducer(
  frames: readonly SimulationFrame[],
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  const first = frames[0]?.timeSeconds ?? 0,
    last = frames.at(-1)?.timeSeconds ?? first;
  const clamp = (time: number) =>
    Math.max(first, Math.min(last, Number.isNaN(time) ? first : time));
  switch (action.type) {
    case "play":
      return {
        ...state,
        timeSeconds:
          state.timeSeconds >= last ? first : clamp(state.timeSeconds),
        playing: frames.length > 1 && last > first,
      };
    case "pause":
      return { ...state, playing: false };
    case "restart":
      return { ...state, timeSeconds: first, playing: false };
    case "scrub":
      return {
        ...state,
        timeSeconds: clamp(action.timeSeconds),
        playing: false,
      };
    case "speed":
      return Number.isFinite(action.speed) && action.speed > 0
        ? { ...state, speed: action.speed }
        : state;
    case "advance": {
      if (
        !state.playing ||
        !Number.isFinite(action.elapsedSeconds) ||
        action.elapsedSeconds <= 0
      )
        return state;
      const timeSeconds = clamp(
        state.timeSeconds + action.elapsedSeconds * state.speed,
      );
      return { ...state, timeSeconds, playing: timeSeconds < last };
    }
  }
}
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
