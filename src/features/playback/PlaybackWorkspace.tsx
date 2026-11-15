"use client";
import BehaviorControls, {
  readBehavior,
} from "../simulation-settings/BehaviorControls";
import { useState } from "react";
import type { SimulationSettings } from "../../domain";
import type { LayoutDocument } from "../editor/layout";
import { executeRun, type ActiveRun } from "./run";
import { createFestivalDemo, festivalDemoSettings } from "./vendorDemo";
import PlaybackView, { RunMessages } from "./PlaybackView";
import "./playback.css";

const startingSettings: SimulationSettings = {
  seed: 42,
  attendeeCount: 250,
  durationSeconds: 120,
  stepSeconds: 0.5,
  frameIntervalSeconds: 1,
  walkingSpeedMetersPerSecond: 1.4,
};
const advancedFields: {
  key: Exclude<keyof SimulationSettings, "behavior">;
  label: string;
  step: string;
}[] = [
  { key: "seed", label: "Random seed", step: "1" },
  { key: "stepSeconds", label: "Fixed simulation step (seconds)", step: "any" },
  {
    key: "frameIntervalSeconds",
    label: "Frame interval (seconds)",
    step: "any",
  },
  {
    key: "walkingSpeedMetersPerSecond",
    label: "Walking speed (meters/second)",
    step: "any",
  },
];
export default function PlaybackWorkspace({
  layout,
}: {
  layout: LayoutDocument;
}) {
  const [active, setActive] = useState<{
    run: ActiveRun;
    id: number;
    example: boolean;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]),
    [warnings, setWarnings] = useState<string[]>([]);
  function startRun(
    source: LayoutDocument,
    settings: SimulationSettings,
    example = false,
  ) {
    const outcome = executeRun(source, settings);
    if (outcome.ok) {
      setErrors([]);
      setWarnings([]);
      setActive((previous) => ({
        run: outcome.run,
        id: (previous?.id ?? 0) + 1,
        example,
      }));
    } else {
      setErrors(outcome.errors);
      setWarnings(outcome.warnings);
    }
  }
  return (
    <section
      className="playback-workspace"
      aria-labelledby="simulation-heading"
    >
      <header>
        <p className="eyebrow">RUN & REVIEW</p>
        <h2 id="simulation-heading">Watch your event in motion</h2>
        <p>
          Choose a guest count and preview length, then watch people move around
          your layout. Or try a ready-made market with eight vendors.
        </p>
      </header>
      <p role="note" className="demo-context">
        Modeled assumptions: guests make price- and budget-sensitive vendor
        choices, take bounded visits to vendors, stages and amenities, roam,
        queue, dwell and exit. Vendors alone have queues and service. These are
        modeled estimates, not forecasts of real customer behavior.
      </p>
      <form
        className="run-settings"
        aria-label="Simulation settings"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const settings = { ...startingSettings };
          for (const key of [
            "attendeeCount",
            ...advancedFields.map((field) => field.key),
          ] as const) {
            const raw = String(data.get(key) ?? "");
            settings[key] = raw.trim() === "" ? NaN : Number(raw);
          }
          const duration = String(data.get("durationMinutes") ?? "");
          settings.durationSeconds =
            duration.trim() === "" ? NaN : Number(duration) * 60;
          settings.behavior = readBehavior(data);
          startRun(layout, settings);
        }}
      >
        <div>
          <label htmlFor="run-attendeeCount">Guests (up to 300)</label>
          <input
            id="run-attendeeCount"
            name="attendeeCount"
            type="number"
            min="0"
            max="300"
            step="1"
            defaultValue={startingSettings.attendeeCount}
            required
          />
        </div>
        <div>
          <label htmlFor="run-durationMinutes">Preview length (minutes)</label>
          <input
            id="run-durationMinutes"
            name="durationMinutes"
            type="number"
            min="0.1"
            step="0.5"
            defaultValue={startingSettings.durationSeconds / 60}
            required
          />
        </div>
        <button type="submit" className="primary">
          Run and watch my layout
        </button>
        <details className="advanced-run-settings">
          <summary>Advanced settings</summary>
          <BehaviorControls />
          <div>
            {advancedFields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`run-${field.key}`}>{field.label}</label>
                <input
                  id={`run-${field.key}`}
                  name={field.key}
                  type="number"
                  step={field.step}
                  defaultValue={startingSettings[field.key]}
                  required
                />
              </div>
            ))}
          </div>
        </details>
      </form>
      <div className="vendor-demo-start">
        <div>
          <strong>See a busier event first</strong>
          <p>
            8 vendors · a stage · bathroom, seating and first aid · a marked
            exit · 300 guests · a 10-minute stay-and-explore preview. Longer
            dwell, finite queues and no random post-stop exits keep visits
            inside the festival. Your editor layout stays unchanged.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            startRun(createFestivalDemo(), festivalDemoSettings, true)
          }
        >
          Try the 8-vendor demo
        </button>
      </div>
      <RunMessages errors={errors} warnings={warnings} />
      {errors.length > 0 && active && (
        <p className="prior-run-note">
          The attempt above was rejected. Playback below is the previous
          successful run.
        </p>
      )}
      {active ? (
        <div key={active.id}>
          {active.example && (
            <div className="demo-context" role="note">
              <strong>Watching the 8-vendor example</strong>
              <p>
                All walking and movement is blue; queues are amber, and guests
                leaving the festival are magenta. Guests at a stop use neutral
                gray. Gray faded guests have exited. The table follows the same
                recorded moment. Guests can also roam and dwell at the stage,
                seating, restrooms and first aid. The engine calculates choices,
                visits, queues, purchases and stockouts from illustrative
                assumptions. Red guests have left a long or full queue and can
                choose another stop. Queue capacity is eight waiting guests per
                stall. The marked entrance/exit is the engine’s actual departure
                point. Longer visits reduce early exits; the recording still
                ends after ten minutes.
              </p>
            </div>
          )}
          <PlaybackView
            autoPlay
            initialSpeed={1}
            festival={active.run.festivalSnapshot}
            result={active.run.result}
            warnings={active.run.warnings}
          />
        </div>
      ) : (
        <div className="playback-empty" role="status">
          <h3>No simulation has run yet</h3>
          <p>
            Try the 8-vendor demo above, or add an entrance to your layout and
            select Run and watch my layout.
          </p>
        </div>
      )}
    </section>
  );
}
