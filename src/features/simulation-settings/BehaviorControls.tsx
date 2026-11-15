import { useState } from "react";
import {
  validateBehaviorSettings,
  DEFAULT_BEHAVIOR_SETTINGS,
  type BehaviorSettings,
} from "../../domain";

export function behaviorFields(
  value: object = DEFAULT_BEHAVIOR_SETTINGS,
  prefix = "",
): { path: string; value: number }[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === "number"
      ? [{ path, value: item }]
      : behaviorFields(item, path);
  });
}
export function parseNumeric(raw: string): number {
  return raw.trim() === "" ? NaN : Number(raw);
}
export function readBehavior(data: FormData): BehaviorSettings {
  const result = structuredClone(DEFAULT_BEHAVIOR_SETTINGS);
  for (const { path } of behaviorFields()) {
    const keys = path.split(".");
    let target = result as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1))
      target = target[key] as Record<string, unknown>;
    target[keys.at(-1)!] = parseNumeric(
      String(data.get(`behavior.${path}`) ?? ""),
    );
  }
  return result;
}
export function behaviorLabel(path: string) {
  const label = path
    .replaceAll(".", " · ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ");
  return (
    label +
    (path.includes("Seconds")
      ? " (seconds)"
      : path === "walkingSpeedMetersPerSecond"
        ? " (meters/second)"
        : "")
  );
}
export default function BehaviorControls() {
  const [error, setError] = useState("");
  return (
    <fieldset
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        try {
          validateBehaviorSettings(readBehavior(new FormData(form)));
          setError("");
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Invalid behavior settings",
          );
        }
      }}
    >
      <legend>Modeled behavior assumptions</legend>
      <p id="behavior-help">
        Weights are relative modeled tendencies, not guaranteed visit
        percentages. Zero weights are accepted unchanged. Missing types and
        fallback choices are handled by the engine. These assumptions influence
        price-sensitive choices, bounded visits, roaming, queue patience and
        dwell. If all destination-type weights are zero, guests exit without a
        visit.
      </p>
      <p>
        Overall stops: integer 1–6; type caps: integer 0–overall; visits per
        destination: integer 1–overall. Roaming waypoints: integer 0–2. Weights
        and elasticity: 0–10; queue tolerance multiplier: 0–5; exit probability:
        0–1. Dwell endpoints and minimum remaining time: 0–3600 seconds; minimum
        must not exceed maximum.
      </p>
      <p role="status" id="behavior-error">
        {error}
      </p>
      {behaviorFields().map(({ path, value }) => (
        <div key={path}>
          <label htmlFor={`behavior.${path}`}>{behaviorLabel(path)}</label>
          <input
            id={`behavior.${path}`}
            name={`behavior.${path}`}
            type="number"
            step="any"
            required
            defaultValue={value}
            aria-invalid={
              !!error &&
              (error.includes(path) ||
                error.includes(path.split(".").slice(-2, -1)[0] ?? path))
            }
            aria-describedby="behavior-help behavior-error"
          />
        </div>
      ))}
    </fieldset>
  );
}
