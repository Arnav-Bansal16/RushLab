import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AmenityType, SimulationSettings } from "../../domain";
import { DEFAULT_BEHAVIOR_SETTINGS } from "../../domain";
import { createVendorDemo, vendorDemoSettings } from "./vendorDemo";
import { executeRun } from "./run";
import { FrameDetails } from "./FrameDetails";
import { attendeeDescription } from "./presentation";
import {
  behaviorFields,
  readBehavior,
} from "../simulation-settings/BehaviorControls";
import ResolvedAssumptions from "../simulation-settings/ResolvedAssumptions";
import { behaviorInputWarnings } from "../simulation-settings/warnings";
import { fitViewport } from "../editor/geometry";

vi.mock("react-konva", () => ({
  Group: ({ children, name }: { children: React.ReactNode; name: string }) =>
    createElement("g", { "data-kind": name }, children),
  Rect: ({
    fill,
    width,
    height,
  }: {
    fill: string;
    width: number;
    height: number;
  }) => createElement("rect", { fill, width, height }),
  Text: ({ text }: { text: string }) => createElement("text", null, text),
}));
import { AmenityMarks } from "./PlaybackCanvas";

function editedSettings(): SimulationSettings {
  const form = new FormData();
  for (const { path, value } of behaviorFields())
    form.set(`behavior.${path}`, String(value));
  form.set("behavior.maximumItineraryStops", "6");
  form.set("behavior.deterministicExitProbabilityAfterStop", "0");
  form.set("behavior.minimumRemainingTimeSeconds", "0");
  for (const type of ["stage", "restroom", "seating", "first_aid"]) {
    form.set(`behavior.destinationTypeWeights.${type}`, "1");
    form.set(`behavior.dwellDurationSeconds.${type}.minimum`, "5");
    form.set(`behavior.dwellDurationSeconds.${type}.maximum`, "10");
  }
  return {
    ...vendorDemoSettings,
    durationSeconds: 600,
    attendeeCount: 250,
    behavior: readBehavior(form),
  };
}

describe("merged SIM-03 / UI-04 public integration", () => {
  it("runs edited assumptions through the public engine and renders generic dwell without an adapter", () => {
    const layout = createVendorDemo();
    layout.vendors[0].averagePrice = 4;
    layout.vendors[0].serviceTimeSeconds = 2;
    layout.stages[0].dwellDurationOverrideSeconds = { minimum: 3, maximum: 4 };
    layout.amenities![0].dwellDurationOverrideSeconds = {
      minimum: 2,
      maximum: 3,
    };
    const settings = editedSettings();
    const before = structuredClone({ layout, settings });
    const first = executeRun(layout, settings);
    const repeated = executeRun(layout, settings);
    if (!first.ok || !repeated.ok) throw new Error("Expected valid edited run");
    expect(repeated.run).toEqual(first.run);
    expect({ layout, settings }).toEqual(before);
    expect(first.run.festivalSnapshot.vendors[0]).toMatchObject({
      averagePrice: 4,
      serviceTimeSeconds: 2,
    });
    expect(first.run.settingsSnapshot.behavior).toEqual(settings.behavior);
    expect(first.run.result.settings.behavior).toEqual(settings.behavior);
    const destinations = new Set(
      first.run.result.frames.flatMap((frame) =>
        frame.attendees.flatMap((a) =>
          a.target ? [a.target.destinationType] : [],
        ),
      ),
    );
    expect(destinations).toEqual(
      new Set(["stage", "vendor", "restroom", "seating", "first_aid"]),
    );
    const statuses = new Set(
      first.run.result.frames.flatMap((frame) =>
        frame.attendees.map((a) => a.status),
      ),
    );
    for (const status of [
      "walking",
      "dwelling",
      "roaming",
      "queued",
      "purchasing",
      "leaving",
      "exited",
    ])
      expect([...statuses]).toContain(status);
    for (const type of ["stage", "restroom", "seating", "first_aid"]) {
      const frame = first.run.result.frames.find((frame) =>
        frame.attendees.some(
          (a) => a.status === "dwelling" && a.target?.destinationType === type,
        ),
      )!;
      expect(frame).toBeDefined();
      const person = frame.attendees.find(
        (a) => a.status === "dwelling" && a.target?.destinationType === type,
      )!;
      const html = renderToStaticMarkup(
        createElement(FrameDetails, {
          festival: first.run.festivalSnapshot,
          frame,
          inspectedId: person.id,
          onInspect: () => {},
        }),
      );
      expect(html).toContain("Dwelling");
      expect(html).toContain(
        attendeeDescription(person, first.run.festivalSnapshot),
      );
    }
    const saved = structuredClone(first.run);
    layout.amenities![0].attraction = 0;
    layout.vendors[0].averagePrice = 999;
    settings.behavior!.dwellDurationSeconds!.stage!.minimum = 0;
    expect(first.run).toEqual(saved);
    // ANA-03 owns these summaries; UI must not synthesize them from frames.
    expect(first.run.result.destinationMetrics.length).toBeGreaterThan(0);
    expect(first.run.result.destinationTransitions.length).toBeGreaterThan(0);
  });
  it("warns on zero weights for available types and preserves zeros through real safe exits", () => {
    const layout = createVendorDemo();
    const behavior = structuredClone(DEFAULT_BEHAVIOR_SETTINGS);
    for (const type of Object.keys(
      behavior.destinationTypeWeights,
    ) as (keyof typeof behavior.destinationTypeWeights)[])
      behavior.destinationTypeWeights[type] = 0;
    const outcome = executeRun(layout, {
      ...vendorDemoSettings,
      attendeeCount: 30,
      behavior,
    });
    if (!outcome.ok) throw new Error(outcome.errors.join(" "));
    expect(outcome.run.warnings.join(" ")).toContain(
      "Guests will exit without a visit",
    );
    expect(outcome.run.result.settings.behavior.destinationTypeWeights).toEqual(
      behavior.destinationTypeWeights,
    );
    expect(
      outcome.run.result.events.some(
        (e) => e.type === "destination_visit_start",
      ),
    ).toBe(false);
    expect(
      outcome.run.result.events
        .filter((e) => e.type === "exit")
        .some((e) => e.reason === "no_eligible_destination"),
    ).toBe(true);
    const missingTypes = { ...layout, stages: [], amenities: [] };
    behavior.destinationTypeWeights.stage = 1;
    expect(behaviorInputWarnings(missingTypes, behavior)).toHaveLength(1);
    expect(
      executeRun({ ...missingTypes, vendors: [] }, vendorDemoSettings).ok,
    ).toBe(true);
  });
  it("shows engine-returned resolved settings independently from later requested edits", () => {
    const requested: SimulationSettings = {
      ...vendorDemoSettings,
      attendeeCount: 0,
      behavior: { priceElasticity: 3 },
    };
    const outcome = executeRun(createVendorDemo(), requested);
    if (!outcome.ok) throw new Error("Expected run");
    requested.behavior!.priceElasticity = 9;
    const html = renderToStaticMarkup(
      createElement(ResolvedAssumptions, {
        settings: outcome.run.result.settings,
      }),
    );
    expect(html).toContain("price Elasticity</dt><dd>3</dd>");
    expect(html).toContain(
      `maximum Itinerary Stops</dt><dd>${DEFAULT_BEHAVIOR_SETTINGS.maximumItineraryStops}</dd>`,
    );
    expect(html).toContain("Later edits above do not change them");
  });
  it("draws all amenity types distinctly from stages and tolerates absent/empty arrays", () => {
    const layout = createVendorDemo();
    const transform = fitViewport(layout.boundsMeters, {
      width: 800,
      height: 500,
    });
    const render = (amenities: typeof layout.amenities) =>
      renderToStaticMarkup(
        createElement(
          "svg",
          null,
          createElement(AmenityMarks, {
            festival: { ...layout, amenities },
            transform,
          }),
        ),
      );
    const html = render(layout.amenities);
    for (const type of ["restroom", "seating", "first_aid"] as AmenityType[])
      expect(html).toContain(type.replaceAll("_", " "));
    for (const color of ["#79a5be", "#a5b5da", "#e39799"])
      expect(html).toContain(color);
    expect(html).not.toContain("#293f3b");
    expect(render([])).toBe("<svg></svg>");
    expect(render(undefined)).toBe("<svg></svg>");
  });
});
