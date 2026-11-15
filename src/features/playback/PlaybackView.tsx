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
import ResolvedAssumptions from "../simulation-settings/ResolvedAssumptions";
import { FrameDetails, StatusLegend } from "./FrameDetails";
import { startPlaybackAnimation } from "./animation";
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
      <label htmlFor="playback-timeline">Event timeline</label>
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
      <p>Pause to look around, or drag the timeline to revisit a moment.</p>
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
  autoPlay = false,
  initialSpeed = 1,
}: {
  festival: Festival;
  result: SimulationResult;
  warnings?: readonly string[];
  autoPlay?: boolean;
  initialSpeed?: number;
}) {
  const frames = result.frames;
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialPlayback>, action: PlaybackAction) =>
      playbackReducer(frames, current, action),
    frames,
    (savedFrames) => ({
      ...initialPlayback(savedFrames),
      playing:
        autoPlay &&
        savedFrames.length > 1 &&
        savedFrames.at(-1)!.timeSeconds > savedFrames[0].timeSeconds,
      speed: initialSpeed,
    }),
  );
  const [inspectedId, setInspectedId] = useState("");
  useEffect(() => {
    if (!state.playing) return;
    return startPlaybackAnimation((elapsedSeconds) =>
      dispatch({ type: "advance", elapsedSeconds }),
    );
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
          {result.settings.attendeeCount} guests · {festival.vendors.length}{" "}
          vendors · {formatTime(last)} recorded preview
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
            {formatTime(frame.timeSeconds)} into the event ·{" "}
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
      <section aria-labelledby="stall-revenue-heading">
        <h3 id="stall-revenue-heading">Money made by each stall · full run</h3>
        <p>
          Modeled revenue in display currency units, returned by the engine for
          the full {result.settings.durationSeconds / 60}-minute run. These
          final totals stay fixed while playback plays or scrubs; they are
          revenue, not profit or a forecast.
        </p>
        {result.vendorMetrics.length ? (
          <div className="vendor-table-wrap">
            <table>
              <caption>Final stall revenue · full run</caption>
              <thead>
                <tr>
                  <th scope="col">Stall</th>
                  <th scope="col">Revenue (display currency units)</th>
                </tr>
              </thead>
              <tbody>
                {result.vendorMetrics.map((metric) => (
                  <tr key={metric.vendorId}>
                    <th scope="row">
                      {festival.vendors.find(
                        (vendor) => vendor.id === metric.vendorId,
                      )?.name ?? metric.vendorId}
                    </th>
                    <td>
                      {metric.revenue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No stall revenue results in this run.</p>
        )}
      </section>
      <StatusLegend />
      <ul aria-label="Map destination legend" className="status-legend">
        {festival.stages.map((item) => (
          <li key={item.id}>{item.name} · stage (dark green)</li>
        ))}
        {(festival.amenities ?? []).map((item) => (
          <li key={item.id}>
            {item.name} · {item.type.replaceAll("_", " ")} (
            {item.type === "restroom"
              ? "blue"
              : item.type === "seating"
                ? "lavender"
                : "pink"}
            )
          </li>
        ))}
      </ul>
      <ResolvedAssumptions settings={result.settings} />
      <details className="playback-recording-details">
        <summary>Recording details</summary>
        <p>
          Seed {result.settings.seed} · requested duration{" "}
          {result.settings.durationSeconds} seconds · last recorded frame {last}{" "}
          seconds · frame {index + 1} of {frames.length}.
        </p>
      </details>
      {frame && (
        <FrameDetails
          festival={festival}
          frame={frame}
          playing={state.playing}
          inspectedId={inspectedId}
          onInspect={setInspectedId}
        />
      )}
    </section>
  );
}
