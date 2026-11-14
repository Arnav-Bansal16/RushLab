import { describe, expect, it, vi } from "vitest";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import {
  addComponent,
  createBlankLayout,
  editComponent,
  fromFestival,
} from "../editor/layout";
import { executeRun } from "./run";
import { frameCursor } from "./controller";

describe("validated engine to playback composition", () => {
  it("never calls the engine on layout or setting rejection and retains warnings", () => {
    const engine = vi.fn(() => structuredClone(demoSimulationResult));
    const layout = addComponent(createBlankLayout(), {
      kind: "exit",
      name: "Exit",
      width: 3,
      height: 3,
      color: "#cc4444",
      shape: "rectangle",
      category: "other",
      servers: 1,
    }).document;
    const invalid = executeRun(layout, demoSimulationResult.settings, engine);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("Expected rejection");
    expect(invalid.warnings.length).toBeGreaterThan(0);
    expect(engine).not.toHaveBeenCalled();
    const settings = executeRun(
      fromFestival(demoFestival),
      { ...demoSimulationResult.settings, stepSeconds: 0 },
      engine,
    );
    expect(settings.ok).toBe(false);
    expect(engine).not.toHaveBeenCalled();
  });
  it("isolates festival, settings, result and frames from later input and engine-result edits", () => {
    const layout = fromFestival(demoFestival),
      settings = { ...demoSimulationResult.settings },
      engineResult = structuredClone(demoSimulationResult);
    const outcome = executeRun(layout, settings, () => engineResult);
    if (!outcome.ok) throw new Error("Expected valid shared fixture");
    const before = structuredClone(outcome.run);
    layout.vendors[0].position.x = 100;
    settings.seed = 99;
    engineResult.frames[0].attendees[0].position.x = 100;
    editComponent(layout, "vendor-tacos", { position: { x: 10, y: 10 } });
    expect(outcome.run).toEqual(before);
    expect(outcome.run.festivalSnapshot).not.toHaveProperty("editor");
  });
  it("preserves warnings even if the public engine rejects execution", () => {
    const layout = addComponent(fromFestival(demoFestival), {
      kind: "custom",
      name: "VIP",
      width: 5,
      height: 5,
      color: "#cc4444",
      shape: "rectangle",
      category: "other",
      servers: 1,
    }).document;
    const outcome = executeRun(layout, demoSimulationResult.settings, () => {
      throw new Error("Engine rejected input");
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("Expected rejection");
    expect(outcome.errors).toEqual(["Engine rejected input"]);
    expect(outcome.warnings).toHaveLength(1);
  });
  it("passes a real public-engine result into the frame controller", () => {
    const layout = fromFestival(demoFestival),
      before = structuredClone(layout);
    const outcome = executeRun(layout, {
      ...demoSimulationResult.settings,
      attendeeCount: 250,
      durationSeconds: 20,
    });
    if (!outcome.ok) throw new Error(outcome.errors.join(" "));
    const frames = outcome.run.result.frames;
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[frameCursor(frames, 999)]).toBe(frames.at(-1));
    expect(outcome.run.result.attendeeProfiles).toHaveLength(250);
    expect(layout).toEqual(before);
  });
});
