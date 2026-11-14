"use client";
import { useState } from "react";
import type { SimulationSettings } from "../../domain";
import type { LayoutDocument } from "../editor/layout";
import { executeRun, type ActiveRun } from "./run";
import { createVendorDemo, vendorDemoSettings } from "./vendorDemo";
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
  key: keyof SimulationSettings;
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
        Modeled assumptions: this version models vendor preferences, queue
        patience, purchases, and stockouts. Prices and personal budgets do not
        yet influence choices. Multi-stop visits, roaming, and stage or amenity
        dwell are planned for a future update.
        Results are modeled estimates, not forecasts.
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
            8 vendors · 2 entrances · 300 guests · a 3-minute preview. Your
            editor layout stays unchanged.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => startRun(createVendorDemo(), vendorDemoSettings, true)}
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
                Watch guests arrive, wait in amber, receive service in green,
                and leave in purple. The table follows the same recorded moment.
                This example uses illustrative stock and service settings;
                SIM-02 calculates all queues, purchases, and stockouts.
              </p>
            </div>
          )}
          <PlaybackView
            autoPlay
            initialSpeed={active.example ? 4 : 1}
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
