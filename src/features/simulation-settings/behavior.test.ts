import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type RunSimulation,
  DEFAULT_BEHAVIOR_SETTINGS,
  resolveBehaviorSettings,
} from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import {
  fromFestival,
  addComponent,
  editComponent,
  removeComponent,
  layoutItems,
} from "../editor/layout";
import { executeRun } from "../playback/run";
import BehaviorControls, {
  behaviorFields,
  parseNumeric,
  readBehavior,
} from "./BehaviorControls";

function data() {
  const form = new FormData();
  for (const { path, value } of behaviorFields())
    form.set(`behavior.${path}`, String(value));
  return form;
}
describe("UI-04 contract handoff", () => {
  it("renders all shared defaults, relative-weight copy, and parses without rewriting zeros", () => {
    expect(readBehavior(data())).toEqual(DEFAULT_BEHAVIOR_SETTINGS);
    const html = renderToStaticMarkup(createElement(BehaviorControls));
    for (const { path } of behaviorFields())
      expect(html).toContain(`name="behavior.${path}"`);
    expect(html).toContain("not guaranteed visit percentages");
    const form = data();
    for (const { path } of behaviorFields())
      if (path.includes("Weights")) form.set(`behavior.${path}`, "0");
    expect(() => resolveBehaviorSettings(readBehavior(form))).not.toThrow();
    expect(readBehavior(form).intentWeights.stage_first).toBe(0);
  });
  it.each(["", " ", "bad", "NaN", "Infinity", "-1", "11"])(
    "rejects invalid weight %s before engine execution",
    (raw) => {
      const form = data();
      form.set("behavior.intentWeights.stage_first", raw);
      const engine = vi.fn<RunSimulation>(() => demoSimulationResult);
      expect(
        executeRun(
          fromFestival(demoFestival),
          { ...demoSimulationResult.settings, behavior: readBehavior(form) },
          engine,
        ).ok,
      ).toBe(false);
      expect(engine).not.toHaveBeenCalled();
    },
  );
  it("rejects range ordering, fractional counts and dependent caps", () => {
    for (const patch of [
      { maximumItineraryStops: 1.5 },
      { maximumItineraryStops: 1 },
      { roamingWaypoints: 3 },
      { dwellDurationSeconds: { stage: { minimum: 200, maximum: 100 } } },
    ])
      expect(
        executeRun(fromFestival(demoFestival), {
          ...demoSimulationResult.settings,
          behavior: { ...structuredClone(DEFAULT_BEHAVIOR_SETTINGS), ...patch },
        }).ok,
      ).toBe(false);
    expect(Number.isNaN(parseNumeric(""))).toBe(true);
  });
  it("passes every edited behavior value, price/service and inherited/overridden dwell without aliasing", () => {
    const layout = fromFestival(demoFestival);
    layout.vendors[0].averagePrice = 99;
    layout.vendors[0].serviceTimeSeconds = 12;
    layout.stages[0].dwellDurationOverrideSeconds = {
      minimum: 10,
      maximum: 20,
    };
    const behavior = structuredClone(DEFAULT_BEHAVIOR_SETTINGS);
    behavior.maximumItineraryStops = 6;
    behavior.maximumVisitsPerDestination = 3;
    behavior.intentWeights.stage_first = 0;
    behavior.priceElasticity = 7;
    const settings = { ...demoSimulationResult.settings, behavior };
    const engine = vi.fn<RunSimulation>(() => demoSimulationResult);
    const outcome = executeRun(layout, settings, engine);
    if (!outcome.ok) throw new Error(outcome.errors.join(" "));
    expect(engine.mock.calls[0]).toEqual([
      outcome.run.festivalSnapshot,
      outcome.run.settingsSnapshot,
    ]);
    expect(outcome.run.settingsSnapshot.behavior).toEqual(behavior);
    const saved = structuredClone(outcome.run);
    behavior.dwellDurationSeconds.stage.minimum = 999;
    layout.vendors[0].averagePrice = 2;
    expect(outcome.run).toEqual(saved);
    expect(DEFAULT_BEHAVIOR_SETTINGS.dwellDurationSeconds.stage.minimum).toBe(
      30,
    );
    expect(
      outcome.run.festivalSnapshot.stages[0].dwellDurationOverrideSeconds,
    ).toEqual({ minimum: 10, maximum: 20 });
    delete layout.stages[0].dwellDurationOverrideSeconds;
    expect(
      executeRun(layout, { ...settings, behavior: undefined }, engine).ok,
    ).toBe(true);
  });
  it("creates vendors with supplied assumptions and supports amenity geometry/deletion", () => {
    const details = {
      name: "Test",
      width: 3,
      height: 3,
      color: "#000000",
      shape: "rectangle" as const,
      category: "food" as const,
      servers: 1,
    };
    const created = addComponent(fromFestival(demoFestival), {
      ...details,
      kind: "vendor",
      averagePrice: 0,
      serviceTimeSeconds: 1,
    });
    expect(created.document.vendors.at(-1)).toMatchObject({
      averagePrice: 0,
      serviceTimeSeconds: 1,
    });
    const amenity = addComponent(created.document, {
      ...details,
      kind: "restroom",
    });
    const edited = editComponent(amenity.document, amenity.id, {
      position: { x: 1, y: 1 },
    });
    expect(edited.amenities?.[0].position).toEqual({ x: 1, y: 1 });
    expect(
      layoutItems(removeComponent(edited, amenity.id)).some(
        (v) => v.id === amenity.id,
      ),
    ).toBe(false);
    expect(executeRun(edited, demoSimulationResult.settings).ok).toBe(true);
  });
});

it("hands off every advanced field unchanged at a nondefault valid value", () => {
  const form = data();
  for (const { path } of behaviorFields()) {
    const value =
      path === "maximumItineraryStops"
        ? 6
        : path.startsWith("maximum")
          ? 3
          : path === "roamingWaypoints"
            ? 2
            : path === "deterministicExitProbabilityAfterStop"
              ? 0.3
              : path.endsWith("minimum")
                ? 12
                : path.endsWith("maximum")
                  ? 24
                  : 0.7;
    form.set(`behavior.${path}`, String(value));
  }
  const behavior = readBehavior(form);
  const engine = vi.fn<RunSimulation>(() => demoSimulationResult);
  const outcome = executeRun(
    fromFestival(demoFestival),
    { ...demoSimulationResult.settings, behavior },
    engine,
  );
  expect(outcome.ok).toBe(true);
  expect(engine.mock.calls[0]?.[1].behavior).toEqual(behavior);
});

it("rejects invalid location overrides and vendor bounds, preserves absent inheritance", () => {
  for (const value of [NaN, Infinity, -1, 10001]) {
    const layout = fromFestival(demoFestival);
    layout.vendors[0].averagePrice = value;
    const engine = vi.fn<RunSimulation>(() => demoSimulationResult);
    expect(executeRun(layout, demoSimulationResult.settings, engine).ok).toBe(
      false,
    );
    expect(engine).not.toHaveBeenCalled();
  }
  for (const value of [0, -1, Infinity, 3601]) {
    const layout = fromFestival(demoFestival);
    layout.vendors[0].serviceTimeSeconds = value;
    expect(executeRun(layout, demoSimulationResult.settings).ok).toBe(false);
  }
  const layout = fromFestival(demoFestival);
  layout.stages[0].dwellDurationOverrideSeconds = { minimum: 50, maximum: 10 };
  expect(executeRun(layout, demoSimulationResult.settings).ok).toBe(false);
  delete layout.stages[0].dwellDurationOverrideSeconds;
  const outcome = executeRun(layout, demoSimulationResult.settings);
  if (!outcome.ok) throw new Error(outcome.errors.join(" "));
  expect(outcome.run.festivalSnapshot.stages[0]).not.toHaveProperty(
    "dwellDurationOverrideSeconds",
  );
});
