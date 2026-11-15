"use client";
import { multiDestinationFestival } from "../../fixtures/multiDestination";
import { demoFestival } from "../../fixtures/demoFestival";
import { useState } from "react";
import type { VendorCategory } from "@/domain";
import {
  componentKinds,
  kindLabels,
  type ComponentKind,
  type NewComponent,
} from "./layout";

const defaults: Record<
  ComponentKind,
  { width: number; height: number; color: string }
> = {
  gate: { width: 0, height: 0, color: "#247963" },
  exit: { width: 3, height: 3, color: "#c44848" },
  vendor: { width: 6, height: 4, color: "#dfaa70" },
  stage: { width: 18, height: 12, color: "#293f3b" },
  path: { width: 20, height: 4, color: "#ded2af" },
  obstacle: { width: 12, height: 2, color: "#91a38b" },
  seating: { width: 16, height: 12, color: "#a5b5da" },
  restroom: { width: 6, height: 5, color: "#79a5be" },
  first_aid: { width: 5, height: 5, color: "#e39799" },
  parking: { width: 24, height: 16, color: "#a7adb4" },
  custom: { width: 12, height: 8, color: "#bfa3d1" },
};
export default function ComponentForm({
  onAdd,
}: {
  onAdd: (details: NewComponent) => void;
}) {
  const [override, setOverride] = useState(false);
  const [kind, setKind] = useState<ComponentKind>("gate");
  return (
    <section className="component-builder" aria-labelledby="add-heading">
      <h2 id="add-heading">Add to your event</h2>
      <p className="muted">
        Use only what your event needs. Add as many of each as you like.
      </p>
      <label htmlFor="component-kind">Component type</label>
      <select
        id="component-kind"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as ComponentKind);
          setOverride(false);
        }}
      >
        {componentKinds.map((value) => (
          <option key={value} value={value}>
            {kindLabels[value]}
          </option>
        ))}
      </select>
      <form
        key={kind}
        className="builder-form"
        aria-label="Add layout component"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get("name") ?? "").trim();
          if (!name) return;
          if (
            override &&
            Number(data.get("dwellMinimum")) > Number(data.get("dwellMaximum"))
          ) {
            const field = event.currentTarget.elements.namedItem(
              "dwellMaximum",
            ) as HTMLInputElement;
            field.setCustomValidity("Maximum must be at least minimum.");
            field.reportValidity();
            return;
          }
          onAdd({
            kind,
            name,
            ...(override &&
            ["stage", "restroom", "seating", "first_aid"].includes(kind)
              ? {
                  dwellDurationOverrideSeconds: {
                    minimum: Number(data.get("dwellMinimum")),
                    maximum: Number(data.get("dwellMaximum")),
                  },
                }
              : {}),
            ...(["stage", "restroom", "seating", "first_aid"].includes(kind)
              ? { attraction: Number(data.get("attraction")) }
              : {}),
            width: Number(data.get("width") ?? 0),
            height: Number(data.get("height") ?? 0),
            color: String(data.get("color")),
            shape: (data.get("shape") ?? "rectangle") as "rectangle" | "circle",
            category: (data.get("category") ?? "food") as VendorCategory,
            servers: Number(data.get("servers") ?? 1),
            averagePrice:
              kind === "vendor" ? Number(data.get("averagePrice")) : undefined,
            serviceTimeSeconds:
              kind === "vendor"
                ? Number(data.get("serviceTimeSeconds"))
                : undefined,
          });
        }}
      >
        <label htmlFor="component-name">Component name</label>
        <input
          id="component-name"
          name="name"
          required
          maxLength={80}
          defaultValue={kindLabels[kind]}
        />
        {kind !== "gate" && (
          <div className="field-pair">
            <div>
              <label htmlFor="component-width">Width (m)</label>
              <input
                id="component-width"
                name="width"
                type="number"
                min="0.5"
                max="2000"
                step="0.5"
                required
                defaultValue={defaults[kind].width}
              />
            </div>
            <div>
              <label htmlFor="component-height">
                {kind === "path" ? "Path thickness (m)" : "Height (m)"}
              </label>
              <input
                id="component-height"
                name="height"
                type="number"
                min="0.5"
                max="2000"
                step="0.5"
                required
                defaultValue={defaults[kind].height}
              />
            </div>
          </div>
        )}
        <label htmlFor="component-color">Color</label>
        <input
          id="component-color"
          name="color"
          type="color"
          defaultValue={defaults[kind].color}
        />
        {![
          "gate",
          "vendor",
          "stage",
          "path",
          "obstacle",
          "seating",
          "restroom",
          "first_aid",
        ].includes(kind) && (
          <>
            <label htmlFor="component-shape">Shape</label>
            <select id="component-shape" name="shape">
              <option value="rectangle">Rectangle</option>
              <option value="circle">Ellipse / circle</option>
            </select>
          </>
        )}
        {kind === "vendor" && (
          <>
            <label htmlFor="component-price">
              Average price (display currency units)
            </label>
            <input
              id="component-price"
              name="averagePrice"
              type="number"
              min="0"
              max="10000"
              step="any"
              required
              defaultValue={demoFestival.vendors[0].averagePrice}
            />
            <label htmlFor="component-service">Service time (seconds)</label>
            <input
              id="component-service"
              name="serviceTimeSeconds"
              type="number"
              min="0"
              onChange={(event) =>
                event.currentTarget.setCustomValidity(
                  event.currentTarget.valueAsNumber > 0
                    ? ""
                    : "Service time must be greater than zero.",
                )
              }
              max="3600"
              step="any"
              required
              defaultValue={demoFestival.vendors[0].serviceTimeSeconds}
            />
            <label htmlFor="component-category">Vendor category</label>
            <select id="component-category" name="category">
              {["food", "drink", "merchandise", "activity", "other"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
            <label htmlFor="component-servers">Service counters</label>
            <input
              id="component-servers"
              name="servers"
              type="number"
              required
              min="1"
              step="1"
              defaultValue="1"
            />
            <p className="muted">
              How many attendees can be served at the same time.
            </p>
          </>
        )}
        {["stage", "restroom", "seating", "first_aid"].includes(kind) && (
          <fieldset>
            <legend>Destination assumptions</legend>
            <label htmlFor="create-attraction">
              Attraction (relative modeled tendency)
            </label>
            <input
              id="create-attraction"
              name="attraction"
              type="number"
              min="0"
              step="any"
              required
              defaultValue={
                kind === "stage"
                  ? demoFestival.stages[0].attraction
                  : multiDestinationFestival.amenities[0].attraction
              }
            />
            <label>
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Override shared type dwell range
            </label>
            {!override && (
              <p>Inherits the shared type range in run settings.</p>
            )}
            {override &&
              ["minimum", "maximum"].map((key) => (
                <div key={key}>
                  <label htmlFor={`create-dwell-${key}`}>
                    {key} dwell (seconds)
                  </label>
                  <input
                    id={`create-dwell-${key}`}
                    name={key === "minimum" ? "dwellMinimum" : "dwellMaximum"}
                    type="number"
                    min="0"
                    max="3600"
                    step="any"
                    required
                    onChange={(e) => {
                      const field = e.currentTarget.form?.elements.namedItem(
                        "dwellMaximum",
                      ) as HTMLInputElement;
                      field?.setCustomValidity("");
                    }}
                  />
                </div>
              ))}
          </fieldset>
        )}
        {kind === "exit" && (
          <p className="muted">
            Exit markers are saved in the layout. Simulated exit routing is not
            connected yet.
          </p>
        )}
        <button className="primary" type="submit">
          Add {kindLabels[kind].toLowerCase()}
        </button>
      </form>
    </section>
  );
}
