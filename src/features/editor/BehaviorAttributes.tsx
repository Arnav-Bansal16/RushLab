import { useState } from "react";
import type { AmenityType } from "../../domain";
import type { LayoutDocument } from "./layout";
import { parseNumeric } from "../simulation-settings/BehaviorControls";

export default function BehaviorAttributes({
  layout,
  id,
  onChange,
}: {
  layout: LayoutDocument;
  id: string;
  onChange: (next: LayoutDocument) => void;
}) {
  const vendor = layout.vendors.find((v) => v.id === id);
  const place = [...layout.stages, ...(layout.amenities ?? [])].find(
    (v) => v.id === id,
  );
  const [draft, setDraft] = useState<Record<string, string>>({
    averagePrice: String(vendor?.averagePrice ?? ""),
    serviceTimeSeconds: String(vendor?.serviceTimeSeconds ?? ""),
    attraction: String(place?.attraction ?? ""),
    minimum: String(place?.dwellDurationOverrideSeconds?.minimum ?? ""),
    maximum: String(place?.dwellDurationOverrideSeconds?.maximum ?? ""),
  });
  const [amenityType, setAmenityType] = useState<AmenityType | undefined>(
    layout.amenities?.find((item) => item.id === id)?.type,
  );
  const [override, setOverride] = useState(
    !!place?.dwellDurationOverrideSeconds,
  );
  const fields = vendor
    ? ["averagePrice", "serviceTimeSeconds"]
    : place
      ? ["attraction", ...(override ? ["minimum", "maximum"] : [])]
      : [];
  const errors = Object.fromEntries(
    fields.map((key) => {
      const value = parseNumeric(draft[key]);
      const max =
        key === "attraction" ? Infinity : key === "averagePrice" ? 10000 : 3600;
      return [
        key,
        !Number.isFinite(value) ||
        value < 0 ||
        value > max ||
        (key === "serviceTimeSeconds" && value === 0)
          ? `Enter a finite value ${key === "serviceTimeSeconds" ? "greater than zero" : "from zero"} ${max === Infinity ? "with no upper limit" : `through ${max}`}.`
          : key === "maximum" && value < parseNumeric(draft.minimum)
            ? "Maximum must be at least minimum."
            : "",
      ];
    }),
  );
  if (!vendor && !place) return null;
  return (
    <fieldset>
      <legend>
        {vendor ? "Vendor assumptions" : "Destination assumptions"}
      </legend>
      {amenityType && (
        <>
          <label htmlFor="attribute-type">Amenity type</label>
          <select
            id="attribute-type"
            value={amenityType}
            onChange={(e) => setAmenityType(e.target.value as AmenityType)}
          >
            {(["restroom", "seating", "first_aid"] as const).map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </>
      )}
      {place && (
        <label>
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          Override shared type dwell range
        </label>
      )}
      {place && !override && (
        <p>
          Inherits the shared type range in run settings. The engine resolves
          inheritance.
        </p>
      )}
      {fields.map((key) => (
        <div key={key}>
          <label htmlFor={`attribute-${key}`}>
            {key === "averagePrice"
              ? "Average price (display currency units)"
              : key === "serviceTimeSeconds"
                ? "Service time (seconds)"
                : key === "attraction"
                  ? "Attraction (relative modeled tendency)"
                  : `${key} dwell (seconds)`}
          </label>
          <input
            id={`attribute-${key}`}
            type="number"
            step="any"
            value={draft[key]}
            aria-invalid={!!errors[key]}
            aria-describedby={`error-${key}`}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
          <p id={`error-${key}`}>{errors[key]}</p>
        </div>
      ))}
      <button
        type="button"
        disabled={Object.values(errors).some(Boolean)}
        onClick={() => {
          const next = structuredClone(layout);
          const target = vendor
            ? next.vendors.find((v) => v.id === id)!
            : [...next.stages, ...(next.amenities ?? [])].find(
                (v) => v.id === id,
              )!;
          if ("averagePrice" in target) {
            target.averagePrice = parseNumeric(draft.averagePrice);
            target.serviceTimeSeconds = parseNumeric(draft.serviceTimeSeconds);
          } else {
            target.attraction = parseNumeric(draft.attraction);
            if ("type" in target && amenityType) target.type = amenityType;
            if (override)
              target.dwellDurationOverrideSeconds = {
                minimum: parseNumeric(draft.minimum),
                maximum: parseNumeric(draft.maximum),
              };
            else delete target.dwellDurationOverrideSeconds;
          }
          onChange(next);
        }}
      >
        Apply assumptions
      </button>
      <p>
        Apply valid values before running. Unapplied edits do not change the
        layout.
      </p>
    </fieldset>
  );
}
