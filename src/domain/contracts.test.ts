import { describe, expect, expectTypeOf, it } from "vitest";
import { demoFestival } from "../fixtures/demoFestival";
import type { Festival } from "./model";
import type {
  CompareScenarios,
  RunSimulation,
  SimulationResult,
  SimulationSettings,
} from "./simulation";

describe("shared contracts", () => {
  it("keeps the demo fixture in world-meter coordinates", () => {
    expect(demoFestival.boundsMeters).toEqual({ width: 120, height: 80 });
    expect(demoFestival.vendors.map((vendor) => vendor.id)).toEqual([
      "vendor-tacos",
    ]);
  });

  it("defines stable engine and comparison boundaries", () => {
    expectTypeOf<RunSimulation>().parameters.toEqualTypeOf<
      [festival: Festival, settings: SimulationSettings]
    >();
    expectTypeOf<CompareScenarios>().returns.toMatchTypeOf<
      ReturnType<CompareScenarios>
    >();
    expectTypeOf<SimulationResult["schemaVersion"]>().toEqualTypeOf<1>();
  });
});
