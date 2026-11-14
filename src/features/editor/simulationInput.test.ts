import { describe, expect, expectTypeOf, it } from "vitest";
import type { Festival, RunSimulation, SimulationSettings } from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult as demoResult } from "../../fixtures/demoSimulationResult";
import {
  addComponent,
  createBlankLayout,
  editComponent,
  fromFestival,
} from "./layout";
import {
  prepareSimulationInput,
  snapshotFestival,
  validateSimulationFestival,
} from "./simulationInput";

const settings: SimulationSettings = { ...demoResult.settings };

describe("SIM-01 frontend handoff", () => {
  it("accepts the shared fixture and produces exactly the approved callable inputs", () => {
    const prepared = prepareSimulationInput(
      fromFestival(demoFestival),
      settings,
    );
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.errors.join(" "));
    expectTypeOf(prepared.festival).toEqualTypeOf<
      Parameters<RunSimulation>[0]
    >();
    expectTypeOf(prepared.settings).toEqualTypeOf<
      Parameters<RunSimulation>[1]
    >();
    expect(prepared.festival).toEqual(demoFestival);
    expect(prepared.settings).toEqual(settings);
    // Contract double only: the real SIM-01 engine does not exist in this checkout.
    const consume: RunSimulation = (festival, configuration) => {
      expect(festival).toEqual(demoFestival);
      expect(configuration).toEqual(settings);
      return structuredClone(demoResult);
    };
    expect(consume(prepared.festival, prepared.settings)).toEqual(demoResult);
  });
  it("isolates later editor/settings changes from an active run snapshot", () => {
    const doc = fromFestival(demoFestival);
    const configuration = { ...settings };
    const prepared = prepareSimulationInput(doc, configuration);
    if (!prepared.ok) throw new Error("Expected valid fixture");
    doc.entrances[0].position.x = 100;
    doc.vendors[0].servers = 5;
    configuration.seed = 999;
    expect(prepared.festival).toEqual(demoFestival);
    expect(prepared.settings.seed).toBe(settings.seed);
    prepared.festival.vendors[0].inventory = 0;
    expect(doc.vendors[0].inventory).toBe(180);
  });
  it("keeps exits and annotations outside the Festival input and visible as warnings", () => {
    const doc = addComponent(fromFestival(demoFestival), {
      kind: "exit",
      name: "Exit",
      width: 3,
      height: 3,
      color: "#cc4444",
      shape: "rectangle",
      category: "other",
      servers: 1,
    }).document;
    const before = structuredClone(doc);
    const prepared = prepareSimulationInput(doc, settings);
    expect(prepared.ok).toBe(true);
    expect(prepared.warnings).toHaveLength(1);
    const festival: Festival = snapshotFestival(doc);
    expect(Object.keys(festival).sort()).toEqual(
      Object.keys(demoFestival).sort(),
    );
    expect(festival).not.toHaveProperty("editor");
    expect(festival.entrances).toEqual(demoFestival.entrances);
    expect(JSON.parse(JSON.stringify(festival))).toEqual(festival);
    expect(doc).toEqual(before);
  });
  it("rejects missing gates, duplicate IDs, nonfinite data, and invalid service/settings", () => {
    expect(prepareSimulationInput(createBlankLayout(), settings).ok).toBe(
      false,
    );
    const invalid = structuredClone(demoFestival) as Festival;
    invalid.vendors[0].id = invalid.entrances[0].id;
    invalid.vendors[0].servers = 0;
    invalid.vendors[0].serviceTimeSeconds = NaN;
    invalid.boundsMeters.width = Infinity;
    expect(validateSimulationFestival(invalid).length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      prepareSimulationInput(fromFestival(demoFestival), {
        ...settings,
        attendeeCount: 301,
        stepSeconds: 0,
        seed: 1.5,
      }).ok,
    ).toBe(false);
  });
  it("accepts independently positioned multiple gates and vendors without changing units", () => {
    let doc = fromFestival(demoFestival);
    const added = addComponent(doc, {
      kind: "gate",
      name: "Second gate",
      width: 0,
      height: 0,
      color: "#247963",
      shape: "circle",
      category: "other",
      servers: 1,
    });
    doc = editComponent(added.document, added.id, {
      position: { x: 10, y: 70 },
    });
    const prepared = prepareSimulationInput(doc, settings);
    if (!prepared.ok) throw new Error(prepared.errors.join(" "));
    expect(prepared.festival.entrances).toHaveLength(2);
    expect(prepared.festival.entrances[1].position).toEqual({ x: 10, y: 70 });
  });
});
