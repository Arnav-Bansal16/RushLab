"use client";
import dynamic from "next/dynamic";
import { useEffect, useReducer, useState } from "react";
import type { Festival, SimulationResult } from "../../domain";
import {
  formatTime,
  frameCursor,
  initialPlayback,
  playbackReducer,
  type PlaybackAction,
} from "./controller";
import { FrameDetails, StatusLegend } from "./FrameDetails";
import "./playback.css";

const PlaybackCanvas = dynamic(() => import("./PlaybackCanvas"), {
  ssr: false,
  loading: () => <p role="status">Loading recorded map…</p>,
});

export function PlaybackControls({
  time,
  first,
  last,
  playing,
  speed,
  disabled,
  onAction,
}: {
  time: number;
  first: number;
  last: number;
  playing: boolean;
  speed: number;
  disabled: boolean;
  onAction: (action: PlaybackAction) => void;
}) {
  return (
    <div className="playback-controls">
      <div className="transport">
        <button
          type="button"
          className="primary"
          disabled={disabled || last <= first}
          onClick={() => onAction({ type: playing ? "pause" : "play" })}
        >
          {playing ? "Pause" : time >= last && !disabled ? "Replay" : "Play"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={() => onAction({ type: "restart" })}
        >
          Restart
        </button>
        <output aria-label="Playback cursor time">
          {formatTime(time)} / {formatTime(last)}
        </output>
        <label htmlFor="playback-speed">Playback speed</label>
        <select
          id="playback-speed"
          value={speed}
          disabled={disabled}
          onChange={(event) =>
            onAction({ type: "speed", speed: Number(event.target.value) })
          }
        >
          {[0.5, 1, 2, 4].map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </div>
      <label htmlFor="playback-timeline">
        Playback timeline (simulation seconds)
      </label>
      <input
        id="playback-timeline"
        type="range"
        min={first}
        max={last}
        step="any"
        value={time}
        disabled={disabled || last <= first}
        aria-valuetext={`${time.toFixed(1)} simulation seconds`}
        onChange={(event) =>
          onAction({ type: "scrub", timeSeconds: event.target.valueAsNumber })
        }
      />
      <p>
        Positions and statuses change only at recorded frames. Playback never
        advances the engine.
      </p>
    </div>
  );
}
export function RunMessages({
  errors,
  warnings,
}: {
  errors: readonly string[];
  warnings: readonly string[];
}) {
  return (
    <>
      {errors.length > 0 && (
        <div role="alert" className="run-errors">
          <strong>Simulation could not run</strong>
          <ul>
            {errors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div
          role="note"
          aria-label="Simulation input warnings"
          className="run-warnings"
        >
          <strong>Input warnings</strong>
          <ul>
            {warnings.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
export default function PlaybackView({
  festival,
  result,
  warnings = [],
}: {
  festival: Festival;
  result: SimulationResult;
  warnings?: readonly string[];
}) {
  const frames = result.frames;
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialPlayback>, action: PlaybackAction) =>
      playbackReducer(frames, current, action),
    frames,
    initialPlayback,
  );
  const [inspectedId, setInspectedId] = useState("");
  useEffect(() => {
    if (!state.playing) return;
    let request = 0,
      previous: number | undefined;
    const tick = (timestamp: number) => {
      if (previous !== undefined)
        dispatch({
          type: "advance",
          elapsedSeconds: (timestamp - previous) / 1000,
        });
      previous = timestamp;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [state.playing]);
  // Browser deltas move a presentation cursor only; selected data always comes from saved simulation time.
  const index = frameCursor(frames, state.timeSeconds),
    frame = index < 0 ? undefined : frames[index];
  const first = frames[0]?.timeSeconds ?? 0,
    last = frames.at(-1)?.timeSeconds ?? first;
  return (
    <section className="playback-result" aria-labelledby="playback-heading">
      <header>
        <p className="eyebrow">RECORDED SIMULATION</p>
        <h2 id="playback-heading">Playback · {festival.name}</h2>
        <p>
          Snapshot: seed {result.settings.seed} ·{" "}
          {result.settings.attendeeCount} attendees · requested duration{" "}
          {result.settings.durationSeconds} s. The last recorded frame is {last}{" "}
          s.
        </p>
      </header>
      <RunMessages errors={[]} warnings={warnings} />
      {!frame ? (
        <div role="status" className="playback-empty">
          This result contains no recorded frames. Run again with valid
          recording settings.
        </div>
      ) : (
        <>
          <PlaybackCanvas festival={festival} frame={frame} />
          <p className="frame-time">
            Recorded frame {index + 1} of {frames.length} ·{" "}
            {frame.timeSeconds.toFixed(1)} s ·{" "}
            {state.playing
              ? "Playing"
              : state.timeSeconds >= last
                ? "At final frame"
                : "Paused"}
          </p>
        </>
      )}
      <PlaybackControls
        time={state.timeSeconds}
        first={first}
        last={last}
        playing={state.playing}
        speed={state.speed}
        disabled={!frames.length}
        onAction={dispatch}
      />
      <StatusLegend />
      {frame && (
        <FrameDetails
          festival={festival}
          frame={frame}
          inspectedId={inspectedId}
          onInspect={setInspectedId}
        />
      )}
    </section>
  );
}
